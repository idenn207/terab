import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { DatabaseService, MountCredentials$Select, ServiceCore, TransactionContext } from '@terab/db';
import { randomBytes, randomUUID } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DriveService } from '../drive/drive.service';
import { StorageAgentClient } from '../storage-agent/storage-agent.client';
import { IssueMountCredentialResponseDto } from './dto/issue-mount-credential-response.dto';
import { MountCredentialDto, toMountCredentialDto } from './dto/mount-credential.dto';
import { MountCredentialRepository } from './mount-credential.repository';
import { renderPowerShellMountScript } from './script-template';
import { SecretStoreFactory } from './secret-store';

const PROTOCOL_ISCSI = 'iscsi';
const IQN_PREFIX = 'iqn.2026-05.com.terab';
const SECRET_PREFIX = 'mount-cred-';
const ACTIVE_UNIQUE_CONSTRAINT = 'mount_credentials_active_unique';
const PG_UNIQUE_VIOLATION = '23505';

// active partial unique index 위반만 도메인 중복으로 판정 — 무관한 unique 위반을 오분류하지 않도록 제약명까지 확인
function isActiveUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string };
  return e?.code === PG_UNIQUE_VIOLATION && e?.constraint === ACTIVE_UNIQUE_CONSTRAINT;
}

export interface IssueResult {
  credential: MountCredentials$Select;
  password: string;
}

@Injectable()
export class MountCredentialService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly mountCredentialRepository: MountCredentialRepository,
    private readonly driveService: DriveService,
    private readonly storageAgentClient: StorageAgentClient,
    private readonly secretStoreFactory: SecretStoreFactory,
    private readonly config: ConfigService,
    @InjectPinoLogger(MountCredentialService.name) private readonly logger: PinoLogger,
  ) {
    super(database, txContext);
  }

  async issue(userId: string, driveId?: string): Promise<IssueMountCredentialResponseDto> {
    const drive = driveId
      ? await this.driveService.findByIdOrThrow(driveId, userId)
      : await this.driveService.ensurePersonalDrive(userId);

    const existing = await this.mountCredentialRepository.findActiveByDriveAndProtocol(
      drive.id,
      userId,
      PROTOCOL_ISCSI,
    );
    if (existing) throw new ApiException('MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL');

    const secretRef = `${SECRET_PREFIX}${randomUUID()}`;
    const password = randomBytes(16).toString('base64url');
    const iqn = `${IQN_PREFIX}:${drive.id}`;
    const store = this.secretStoreFactory.get();

    await store.write(secretRef, password);
    let targetCreated = false;
    try {
      // insert 를 createTarget 앞에 두고 한 트랜잭션으로 묶는다 — partial unique index 가
      // 동시 발급 패배자를 외부 target 생성 전에 거르고, createTarget 실패 시 insert 가 자동 롤백된다
      const response = await this.runInTx(async () => {
        const row = await this.mountCredentialRepository.insertIssued({
          driveId: drive.id,
          userId,
          protocol: PROTOCOL_ISCSI,
          osUsername: secretRef,
          secretRef,
          iqn,
        });

        await this.storageAgentClient.createTarget({
          iqn,
          name: drive.name,
          osUsername: secretRef,
          osPassword: password,
        });
        targetCreated = true;

        const portal = this.portal();
        const dto = toMountCredentialDto(row, portal);
        const script = renderPowerShellMountScript({
          portalHost: portal.host,
          portalPort: portal.port,
          iqn,
          chapUsername: secretRef,
          chapPassword: password,
          driveName: drive.name,
          issuedAt: row.createdAt,
        });
        return { ...dto, password, script };
      });

      this.logger.info(
        { userId, driveId: drive.id, credentialId: response.id },
        'mount credential issued',
      );
      return response;
    } catch (err) {
      if (isActiveUniqueViolation(err)) {
        await store.remove(secretRef);
        throw new ApiException('MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL');
      }
      this.logger.warn(
        { err, userId, driveId: drive.id, targetCreated },
        'mount credential issue failed — rolling back',
      );
      // createTarget 성공 뒤 tx 가 abort(예: commit 실패)하면 행은 롤백되나 외부 target 은 남으므로 보상
      if (targetCreated) {
        try {
          await this.storageAgentClient.deleteTarget(iqn);
        } catch (rbErr) {
          this.logger.error({ err: rbErr, iqn }, 'rollback deleteTarget failed');
        }
      }
      await store.remove(secretRef);
      throw err;
    }
  }

  async revoke(userId: string, credentialId: string): Promise<void> {
    const row = await this.mountCredentialRepository.findByIdAndUserId(credentialId, userId);
    if (!row) throw new ApiException('MOUNT_CREDENTIAL_NOT_FOUND');
    if (row.revokedAt) throw new ApiException('MOUNT_CREDENTIAL_REVOKED');

    if (row.iqn) {
      try {
        await this.storageAgentClient.deleteTarget(row.iqn);
      } catch (err) {
        if (err instanceof ApiException && err.code === 'STORAGE_AGENT_TARGET_NOT_FOUND') {
          this.logger.warn({ iqn: row.iqn }, 'revoke: target already absent (idempotent)');
        } else {
          throw err;
        }
      }
    }

    await this.secretStoreFactory.get().remove(row.secretRef);
    await this.mountCredentialRepository.softRevoke(row.id, new Date());

    this.logger.info({ userId, credentialId }, 'mount credential revoked');
  }

  async listActive(userId: string): Promise<MountCredentialDto[]> {
    const rows = await this.mountCredentialRepository.findActiveByUserId(userId);
    const portal = this.portal();
    return rows.map((row) => toMountCredentialDto(row, portal));
  }

  private portal(): { host: string; port: number } {
    return {
      host: this.config.getOrThrow<string>('STORAGE_AGENT_PORTAL_HOST'),
      port: parseInt(this.config.getOrThrow<string>('STORAGE_AGENT_PORTAL_PORT'), 10),
    };
  }
}
