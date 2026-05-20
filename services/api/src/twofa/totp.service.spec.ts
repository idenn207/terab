import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { EncryptionService } from '@terab/security';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { generateSecret, generateSync } from 'otplib';
import { TotpRepository } from './totp.repository';
import { TotpService } from './totp.service';

const mockTotpRepository = {
  findByUserId: jest.fn(),
  insert: jest.fn(),
  updateLastUsedAt: jest.fn(),
};

const validKey = Buffer.alloc(32, 'x').toString('base64');

describe('TotpService', () => {
  let service: TotpService;
  let encryption: EncryptionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TotpService,
        EncryptionService,
        { provide: ConfigService, useValue: { getOrThrow: () => validKey } },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TotpRepository, useValue: mockTotpRepository },
      ],
    }).compile();
    service = module.get(TotpService);
    encryption = module.get(EncryptionService);
    jest.clearAllMocks();
  });

  describe('startSetup', () => {
    it('이미 등록된 TOTP가 있으면 status=ENROLLED 반환', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue({ id: 'existing' });
      const result = await service.startSetup('user-1');
      expect(result.status).toBe('ENROLLED');
    });

    it('미등록 상태면 secret + otpauth URI를 반환', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const result = await service.startSetup('user-1');
      expect(result.status).toBe('PENDING');
      if (result.status !== 'PENDING') throw new Error();
      expect(result.secret).toMatch(/^[A-Z2-7]+$/); // base32
      expect(result.otpauthUri).toContain('otpauth://totp/');
      expect(result.otpauthUri).toContain('terab');
    });
  });

  describe('completeSetup', () => {
    it('이미 등록된 TOTP가 있으면 TWOFA_SETUP_NOT_SUPPORTED', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue({ id: 'existing' });
      await expect(service.completeSetup('user-1', 'secret', '123456')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });

    it('잘못된 코드면 TWOFA_TOTP_INVALID_CODE', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const secret = generateSecret();
      await expect(service.completeSetup('user-1', secret, '000000')).rejects.toMatchObject({
        code: 'TWOFA_TOTP_INVALID_CODE',
      });
    });

    it('올바른 코드면 secret을 암호화해 저장', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const secret = generateSecret();
      const validCode = generateSync({ secret });
      mockTotpRepository.insert.mockResolvedValue({ id: 'totp-1' });

      await service.completeSetup('user-1', secret, validCode);

      expect(mockTotpRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          secretEncrypted: expect.any(Buffer),
          iv: expect.any(Buffer),
          authTag: expect.any(Buffer),
        }),
      );
    });
  });

  describe('verifyCode', () => {
    it('등록 안 된 사용자면 false', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const ok = await service.verifyCode('user-1', '123456');
      expect(ok).toBe(false);
    });

    it('올바른 코드면 true + lastUsedAt 갱신', async () => {
      const secret = generateSecret();
      const enc = encryption.encrypt(secret);
      mockTotpRepository.findByUserId.mockResolvedValue({
        id: 'totp-1',
        secretEncrypted: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
      });
      const validCode = generateSync({ secret });

      const ok = await service.verifyCode('user-1', validCode);

      expect(ok).toBe(true);
      expect(mockTotpRepository.updateLastUsedAt).toHaveBeenCalledWith('totp-1', expect.any(Date));
    });

    it('잘못된 코드면 false + lastUsedAt 미갱신', async () => {
      const secret = generateSecret();
      const enc = encryption.encrypt(secret);
      mockTotpRepository.findByUserId.mockResolvedValue({
        id: 'totp-1',
        secretEncrypted: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
      });

      const ok = await service.verifyCode('user-1', '000000');

      expect(ok).toBe(false);
      expect(mockTotpRepository.updateLastUsedAt).not.toHaveBeenCalled();
    });
  });
});
