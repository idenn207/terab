import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import { DeviceResponseDto } from './dto';
import { DeviceRepository } from './device.repository';

@Injectable()
export class DeviceService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly deviceRepository: DeviceRepository,
  ) {
    super(database, txContext);
  }

  @LogReplay()
  async register(userId: string, pushToken: string, userAgent: string | undefined): Promise<void> {
    await this.deviceRepository.upsert(userId, pushToken, userAgent);
  }

  async list(userId: string): Promise<DeviceResponseDto[]> {
    const rows = await this.deviceRepository.findByUserId(userId);
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async remove(id: string, userId: string): Promise<void> {
    const device = await this.deviceRepository.findByIdAndUserId(id, userId);
    if (!device) throw new ApiException('DEVICE_NOT_FOUND');
    await this.deviceRepository.deleteById(id);
  }

  async findPushTokensByUserId(userId: string): Promise<string[]> {
    const rows = await this.deviceRepository.findByUserId(userId);
    return rows.map((r) => r.pushToken);
  }

  async deactivateByPushToken(userId: string, pushToken: string): Promise<void> {
    await this.deviceRepository.deleteByUserIdAndPushToken(userId, pushToken);
  }
}
