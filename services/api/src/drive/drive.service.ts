import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { DatabaseService, Drives$Select, ServiceCore, TransactionContext } from '@terab/db';
import { randomUUID } from 'crypto';
import { DriveRepository } from './drive.repository';

const PERSONAL_DRIVE_NAME = '내 드라이브';
const PERSONAL_DRIVE_KIND = 'PRIVATE';

@Injectable()
export class DriveService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly driveRepository: DriveRepository,
    private readonly config: ConfigService,
  ) {
    super(database, txContext);
  }

  async ensurePersonalDrive(userId: string): Promise<Drives$Select> {
    const existing = await this.driveRepository.findPersonalByOwnerId(userId);
    if (existing) return existing;

    // id 를 Node 측에서 미리 발급해 mountPath = ${root}/${driveId} 결정 — drives.mountPath unique 제약 자연 충족
    const id = randomUUID();
    const root = this.config.getOrThrow<string>('STORAGE_DRIVE_ROOT');
    return this.runInTx(() =>
      this.driveRepository.create({
        id,
        ownerId: userId,
        name: PERSONAL_DRIVE_NAME,
        kind: PERSONAL_DRIVE_KIND,
        mountPath: `${root}/${id}`,
      }),
    );
  }

  async findByIdOrThrow(driveId: string, userId: string): Promise<Drives$Select> {
    const drive = await this.driveRepository.findById(driveId);
    if (!drive) throw new ApiException('DRIVE_NOT_FOUND');
    if (drive.ownerId !== userId) throw new ApiException('DRIVE_FORBIDDEN');
    return drive;
  }
}
