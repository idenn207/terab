import { ApiProperty } from '@nestjs/swagger';

export class InvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  token!: string;

  url!: string;

  expiresAt!: Date;
}
