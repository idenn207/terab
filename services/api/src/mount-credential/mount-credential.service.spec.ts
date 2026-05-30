import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { getLoggerToken } from 'nestjs-pino';
import { DriveService } from '../drive/drive.service';
import { StorageAgentClient } from '../storage-agent/storage-agent.client';
import { MountCredentialRepository } from './mount-credential.repository';
import { MountCredentialService } from './mount-credential.service';
import { SecretStoreFactory } from './secret-store';

const driveSample = {
  id: 'drive-1',
  ownerId: 'user-1',
  name: '내 드라이브',
  kind: 'PRIVATE',
  mountPath: '/volume1/drives/drive-1',
};

const rowSample = {
  id: 'cred-1',
  driveId: 'drive-1',
  userId: 'user-1',
  protocol: 'iscsi',
  osUsername: 'mount-cred-abc',
  secretRef: 'mount-cred-abc',
  iqn: 'iqn.2026-05.com.terab:drive-1',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-05-30T00:00:00Z'),
  updatedAt: new Date('2026-05-30T00:00:00Z'),
};

describe('MountCredentialService', () => {
  let service: MountCredentialService;
  const repo = {
    findActiveByUserId: jest.fn(),
    findActiveByDriveAndProtocol: jest.fn(),
    findByIdAndUserId: jest.fn(),
    insertIssued: jest.fn(),
    softRevoke: jest.fn(),
  };
  const driveService = {
    ensurePersonalDrive: jest.fn(),
    findByIdOrThrow: jest.fn(),
  };
  const agentClient = {
    createTarget: jest.fn(),
    deleteTarget: jest.fn(),
  };
  const secretStore = {
    write: jest.fn(),
    remove: jest.fn(),
  };
  const secretStoreFactory = {
    get: () => secretStore,
  };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'STORAGE_AGENT_PORTAL_HOST') return '192.168.0.5';
      if (key === 'STORAGE_AGENT_PORTAL_PORT') return '3260';
      throw new Error(`unexpected key ${key}`);
    }),
  };
  const noopLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MountCredentialService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: MountCredentialRepository, useValue: repo },
        { provide: DriveService, useValue: driveService },
        { provide: StorageAgentClient, useValue: agentClient },
        { provide: SecretStoreFactory, useValue: secretStoreFactory },
        { provide: ConfigService, useValue: config },
        { provide: getLoggerToken(MountCredentialService.name), useValue: noopLogger },
      ],
    }).compile();
    service = module.get(MountCredentialService);
    jest.clearAllMocks();
    driveService.ensurePersonalDrive.mockResolvedValue(driveSample);
    driveService.findByIdOrThrow.mockResolvedValue(driveSample);
  });

  describe('issue', () => {
    it('성공 시 secret write → agent create → DB insert 순서 + password+script 포함 응답', async () => {
      repo.findActiveByDriveAndProtocol.mockResolvedValue(null);
      secretStore.write.mockResolvedValue('mount-cred-x');
      agentClient.createTarget.mockResolvedValue({ id: 1, iqn: 'x' });
      repo.insertIssued.mockResolvedValue(rowSample);

      const result = await service.issue('user-1');

      expect(secretStore.write).toHaveBeenCalled();
      expect(agentClient.createTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          iqn: 'iqn.2026-05.com.terab:drive-1',
          name: '내 드라이브',
        }),
      );
      expect(repo.insertIssued).toHaveBeenCalledWith(
        expect.objectContaining({
          driveId: 'drive-1',
          userId: 'user-1',
          protocol: 'iscsi',
          iqn: 'iqn.2026-05.com.terab:drive-1',
        }),
      );
      expect(result.password).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.script).toContain('New-IscsiTargetPortal');
      expect(result.portalHost).toBe('192.168.0.5');
      expect(result.portalPort).toBe(3260);
    });

    it('동일 protocol active 자격증명 존재 시 MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL', async () => {
      repo.findActiveByDriveAndProtocol.mockResolvedValue(rowSample);
      await expect(service.issue('user-1')).rejects.toBeInstanceOf(ApiException);
      expect(secretStore.write).not.toHaveBeenCalled();
      expect(agentClient.createTarget).not.toHaveBeenCalled();
    });

    it('agent.createTarget 실패 시 secret rollback + agent rollback 미호출', async () => {
      repo.findActiveByDriveAndProtocol.mockResolvedValue(null);
      secretStore.write.mockResolvedValue('mount-cred-x');
      agentClient.createTarget.mockRejectedValue(new ApiException('STORAGE_AGENT_INTERNAL'));

      await expect(service.issue('user-1')).rejects.toBeInstanceOf(ApiException);
      expect(secretStore.remove).toHaveBeenCalledTimes(1);
      expect(agentClient.deleteTarget).not.toHaveBeenCalled();
      expect(repo.insertIssued).not.toHaveBeenCalled();
    });

    it('DB insert 실패 시 agent.deleteTarget + secret.remove 둘 다 호출 (full rollback)', async () => {
      repo.findActiveByDriveAndProtocol.mockResolvedValue(null);
      secretStore.write.mockResolvedValue('mount-cred-x');
      agentClient.createTarget.mockResolvedValue({ id: 1, iqn: 'x' });
      repo.insertIssued.mockRejectedValue(new Error('db down'));

      await expect(service.issue('user-1')).rejects.toThrow();
      expect(agentClient.deleteTarget).toHaveBeenCalledTimes(1);
      expect(secretStore.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('revoke', () => {
    it('row 부재 시 MOUNT_CREDENTIAL_NOT_FOUND', async () => {
      repo.findByIdAndUserId.mockResolvedValue(null);
      await expect(service.revoke('user-1', 'cred-1')).rejects.toBeInstanceOf(ApiException);
    });

    it('이미 revoked 면 MOUNT_CREDENTIAL_REVOKED', async () => {
      repo.findByIdAndUserId.mockResolvedValue({ ...rowSample, revokedAt: new Date() });
      await expect(service.revoke('user-1', 'cred-1')).rejects.toBeInstanceOf(ApiException);
    });

    it('happy path: agent.delete → secret.remove → softRevoke 순서', async () => {
      repo.findByIdAndUserId.mockResolvedValue(rowSample);
      agentClient.deleteTarget.mockResolvedValue(undefined);

      await service.revoke('user-1', 'cred-1');

      expect(agentClient.deleteTarget).toHaveBeenCalledWith(rowSample.iqn);
      expect(secretStore.remove).toHaveBeenCalledWith(rowSample.secretRef);
      expect(repo.softRevoke).toHaveBeenCalledWith(rowSample.id, expect.any(Date));
    });

    it('agent.deleteTarget 의 TARGET_NOT_FOUND 는 idempotent 통과', async () => {
      repo.findByIdAndUserId.mockResolvedValue(rowSample);
      agentClient.deleteTarget.mockRejectedValue(
        new ApiException('STORAGE_AGENT_TARGET_NOT_FOUND'),
      );

      await service.revoke('user-1', 'cred-1');

      expect(secretStore.remove).toHaveBeenCalled();
      expect(repo.softRevoke).toHaveBeenCalled();
    });

    it('agent 다른 실패는 전파 + DB softRevoke 미호출', async () => {
      repo.findByIdAndUserId.mockResolvedValue(rowSample);
      agentClient.deleteTarget.mockRejectedValue(new ApiException('STORAGE_AGENT_INTERNAL'));

      await expect(service.revoke('user-1', 'cred-1')).rejects.toBeInstanceOf(ApiException);
      expect(repo.softRevoke).not.toHaveBeenCalled();
    });
  });

  describe('listActive', () => {
    it('repository 결과를 portal 정보와 함께 DTO 로 변환', async () => {
      repo.findActiveByUserId.mockResolvedValue([rowSample]);
      const result = await service.listActive('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].portalHost).toBe('192.168.0.5');
      expect(result[0].portalPort).toBe(3260);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0]).not.toHaveProperty('script');
    });
  });
});
