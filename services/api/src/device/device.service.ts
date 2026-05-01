import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { contract } from '@terab/contract';
import { ServerInferResponseBody } from '@ts-rest/core';
import { DeviceRepository } from './device.repository';

@Injectable()
export class DeviceService {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async register(userId: string, pushToken: string, userAgent: string | undefined): Promise<void> {
    await this.deviceRepository.upsert(userId, pushToken, userAgent);
  }

  async findAll(userId: string): Promise<ServerInferResponseBody<typeof contract.device.list>> {
    const rows = await this.deviceRepository.findByUserId(userId);
    return rows.map((r) => ({ ...r, userAgent: r.userAgent ?? undefined }));
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
}
