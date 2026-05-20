import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}
@Injectable()
export class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LEN = 12;
  private readonly TAG_LEN = 16;
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const base64 = configService.getOrThrow<string>('TWOFA_MASTER_KEY');
    const key = Buffer.from(base64, 'base64');
    if (key.length !== 32) {
      throw new Error('TWOFA_MASTER_KEY must decode to 32 bytes for AES-256-GCM');
    }
    this.key = key;
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(this.IV_LEN);
    const cipher = createCipheriv(this.ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag };
  }

  decrypt(payload: EncryptedPayload): string {
    if (payload.authTag.length !== this.TAG_LEN) {
      throw new Error('Invalid auth tag length');
    }
    const decipher = createDecipheriv(this.ALGORITHM, this.key, payload.iv);
    decipher.setAuthTag(payload.authTag);
    const plaintext = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
