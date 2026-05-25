import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../../auth/auth.service';
import { UserService } from '../../user/user.service';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeRegenerateBodyDto } from './dto';

@Injectable()
export class BackupCodeService extends ServiceCore {
  private readonly BCRYPT_ROUNDS = 10;
  private readonly CODE_COUNT = 8;
  private readonly CODE_BYTES = 4;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly backupCodeRepository: BackupCodeRepository,
  ) {
    super(database, txContext);
  }

  async generateForUser(userId: string): Promise<string[]> {
    const rawCodes = this.generateRawCodes();
    const codeHashes = await Promise.all(rawCodes.map((code) => bcrypt.hash(code, this.BCRYPT_ROUNDS)));
    await this.backupCodeRepository.insertMany(userId, codeHashes);
    return rawCodes;
  }

  async regenerateForUser(userId: string, data: BackupCodeRegenerateBodyDto): Promise<string[]> {
    const dbUser = await this.userService.findById(userId);
    if (!dbUser) throw new ApiException('INVALID_CREDENTIALS');
    await this.authService.validateCredentials(dbUser, data.currentPassword);

    return this.runInTx(async () => {
      const now = new Date();
      const unused = await this.backupCodeRepository.findUnusedByUserId(userId);
      await Promise.all(unused.map((c) => this.backupCodeRepository.markUsed(c.id, now)));
      return this.generateForUser(userId);
    });
  }

  async consume(userId: string, rawCode: string): Promise<void> {
    const codes = await this.backupCodeRepository.findUnusedByUserId(userId);
    // 타이밍 오라클 방지 — 매칭 여부와 무관하게 모든 코드를 순회
    let matchedId: string | null = null;
    for (const code of codes) {
      const match = await bcrypt.compare(rawCode, code.codeHash);
      if (match && matchedId === null) {
        matchedId = code.id;
      }
    }
    if (matchedId === null) throw new ApiException('BACKUP_CODE_INVALID');
    await this.backupCodeRepository.markUsed(matchedId, new Date());
  }

  async list(userId: string) {
    const unused = await this.backupCodeRepository.findUnusedByUserId(userId);
    return unused;
  }

  private generateRawCodes(): string[] {
    return Array.from({ length: this.CODE_COUNT }, () => {
      const buf = randomBytes(this.CODE_BYTES);
      const hex = buf.toString('hex').toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4)}`;
    });
  }
}
