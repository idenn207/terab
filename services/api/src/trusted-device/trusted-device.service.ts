import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { TokenService } from '@terab/core';
import { randomUUID } from 'node:crypto';
import { TrustedDeviceResponseDto } from './dto/trusted-device-response.dto';
import { TrustedDeviceRepository } from './trusted-device.repository';

@Injectable()
export class TrustedDeviceService {
  private TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30일
  constructor(
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    private readonly tokenService: TokenService,
  ) {}

  async register(userId: string, userAgent: string | undefined): Promise<string> {
    const rawToken = `${randomUUID()}-${randomUUID()}`;
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.TRUST_DURATION_MS);
    await this.trustedDeviceRepository.insert(userId, tokenHash, userAgent, expiresAt);
    return rawToken;
  }

  async verify(rawToken: string | undefined, userId: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = this.tokenService.hashToken(rawToken);
    const device = await this.trustedDeviceRepository.findByTokenHash(tokenHash);
    if (!device) return false;
    if (device.userId !== userId) return false;
    if (device.expiresAt <= new Date()) return false;
    return true;
  }

  async findAll(userId: string): Promise<TrustedDeviceResponseDto[]> {
    const rows = await this.trustedDeviceRepository.findByUserId(userId);
    return rows.map((r) => ({ ...r, userAgent: r.userAgent ?? undefined }));
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
