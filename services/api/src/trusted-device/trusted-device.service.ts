import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import { TokenService } from '@terab/security';
import { randomUUID } from 'node:crypto';
import { TrustedDeviceResponseDto } from './dto';
import { TrustedDeviceRepository } from './trusted-device.repository';

@Injectable()
export class TrustedDeviceService extends ServiceCore {
  private readonly TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30일 — 매 verify 시 갱신되는 sliding window
  private readonly TRUST_ABSOLUTE_MAX_MS = 90 * 24 * 60 * 60 * 1000; // 90일 — sliding의 절대 상한(rolling exposure 차단)
  private readonly MAX_TRUST_PER_USER = 10;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    private readonly tokenService: TokenService,
  ) {
    super(database, txContext);
  }

  @LogReplay()
  async register(userId: string, userAgent: string | undefined): Promise<string> {
    const rawToken = `${randomUUID()}-${randomUUID()}`;
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.TRUST_DURATION_MS);
    await this.runInTx(async () => {
      await this.trimExcessDevices(userId);
      await this.trustedDeviceRepository.insert(userId, tokenHash, userAgent, expiresAt);
    });
    return rawToken;
  }

  // 신규 1대 자리 확보 — 현재 활성이 MAX-1을 넘으면 그 초과분만큼 oldest 폐기
  private async trimExcessDevices(userId: string): Promise<void> {
    const now = new Date();
    const active = await this.trustedDeviceRepository.countActiveByUserId(userId, now);
    const overflow = active - (this.MAX_TRUST_PER_USER - 1);
    if (overflow > 0) {
      await this.trustedDeviceRepository.deleteOldestByUserId(userId, overflow);
    }
  }

  async verify(rawToken: string | undefined, userId: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = this.tokenService.hashToken(rawToken);
    const device = await this.trustedDeviceRepository.findByTokenHash(tokenHash);
    if (!device) return false;
    if (device.userId !== userId) return false;
    const now = new Date();
    if (device.expiresAt <= now) return false;
    await this.slideExpiresAt(device, now);
    return true;
  }

  // sliding window: verify 성공 시 expiresAt을 now + TRUST_DURATION_MS로 연장하되 createdAt + TRUST_ABSOLUTE_MAX_MS를 초과하지 않는다(rolling exposure 차단)
  private async slideExpiresAt(
    device: { id: string; createdAt: Date; expiresAt: Date },
    now: Date,
  ): Promise<void> {
    const candidateExpiresAt = new Date(now.getTime() + this.TRUST_DURATION_MS);
    const hardCapAt = new Date(device.createdAt.getTime() + this.TRUST_ABSOLUTE_MAX_MS);
    const newExpiresAt = candidateExpiresAt < hardCapAt ? candidateExpiresAt : hardCapAt;
    if (newExpiresAt > device.expiresAt) {
      await this.trustedDeviceRepository.refreshExpiresAt(device.id, newExpiresAt);
    }
  }

  async list(userId: string): Promise<TrustedDeviceResponseDto[]> {
    const rows = await this.trustedDeviceRepository.findByUserId(userId);
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async revoke(id: string, userId: string): Promise<void> {
    const device = await this.trustedDeviceRepository.findByIdAndUserId(id, userId);
    if (!device) throw new ApiException('TRUSTED_DEVICE_NOT_FOUND');
    await this.trustedDeviceRepository.deleteById(id);
  }

  get trustDurationMs(): number {
    return this.TRUST_DURATION_MS;
  }
}
