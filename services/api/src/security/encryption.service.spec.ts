import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

const validKey = Buffer.alloc(32, 'x').toString('base64'); // 32바이트

describe('EncryptionService', () => {
  const buildService = (key: string) => {
    return Test.createTestingModule({
      providers: [EncryptionService, { provide: ConfigService, useValue: { getOrThrow: () => key } }],
    })
      .compile()
      .then((m) => m.get(EncryptionService));
  };

  describe('초기화', () => {
    it('TWOFA_MASTER_KEY가 base64 32바이트가 아니면 throw', async () => {
      const tooShort = Buffer.alloc(16, 'x').toString('base64');
      await expect(buildService(tooShort)).rejects.toThrow(/32 bytes/);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('같은 plaintext를 두 번 암호화하면 IV가 다르고 ciphertext도 다르다', async () => {
      const service = await buildService(validKey);
      const a = service.encrypt('secret-value');
      const b = service.encrypt('secret-value');
      expect(a.iv).not.toEqual(b.iv);
      expect(a.ciphertext).not.toEqual(b.ciphertext);
    });

    it('encrypt 결과를 decrypt하면 원본 plaintext가 복원된다', async () => {
      const service = await buildService(validKey);
      const enc = service.encrypt('my-totp-secret');
      const dec = service.decrypt(enc);
      expect(dec).toBe('my-totp-secret');
    });

    it('auth_tag가 변조되면 decrypt가 throw한다', async () => {
      const service = await buildService(validKey);
      const enc = service.encrypt('value');
      enc.authTag[0] ^= 0xff;
      expect(() => service.decrypt(enc)).toThrow();
    });

    it('ciphertext가 변조되면 decrypt가 throw한다', async () => {
      const service = await buildService(validKey);
      const enc = service.encrypt('value');
      enc.ciphertext[0] ^= 0xff;
      expect(() => service.decrypt(enc)).toThrow();
    });
  });
});
