import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { contract } from '@terab/contract';
import { Invitations$Select } from '@terab/db';
import { ServerInferResponseBody } from '@ts-rest/core';
import { InvitationRepository } from './invitation.repository';

@Injectable()
export class InvitationService {
  protected readonly DEFAULT_EXPIRES_DAYS = 7;
  protected readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createdBy: string,
    expiresInDays: number = this.DEFAULT_EXPIRES_DAYS,
  ): Promise<ServerInferResponseBody<typeof contract.invitation.create>> {
    const expiresAt = new Date(Date.now() + expiresInDays * this.MS_PER_DAY);
    const row = await this.invitationRepository.insert({ createdBy, expiresAt });
    const baseUrl = this.configService.getOrThrow<string>('APP_BASE_URL');
    return { token: row.token, url: `${baseUrl}/register/${row.token}`, expiresAt: row.expiresAt };
  }

  async validate(token: string): Promise<ServerInferResponseBody<typeof contract.invitation.validate>> {
    const row = await this.invitationRepository.findByToken(token);
    return { valid: this.getException(row) === null };
  }

  async validateOrThrow(token: string) {
    const row = await this.invitationRepository.findByToken(token);
    const exception = this.getException(row);
    if (exception) throw exception;
    return row;
  }

  async deactivate(token: string): Promise<void> {
    const found = await this.invitationRepository.deactivate(token);
    if (!found) throw new ApiException('INVITATION_NOT_FOUND');
  }

  async markUsed(token: string, usedBy: string) {
    await this.invitationRepository.markUsed(token, usedBy);
  }

  private getException(
    row: Pick<Invitations$Select, 'deactivatedAt' | 'usedAt' | 'expiresAt'> | null,
  ): ApiException | null {
    if (!row || row.deactivatedAt !== null) return new ApiException('INVITATION_NOT_FOUND');
    if (row.usedAt !== null) return new ApiException('INVITATION_ALREADY_USED');
    if (row.expiresAt <= new Date()) return new ApiException('INVITATION_EXPIRED');
    return null;
  }
}
