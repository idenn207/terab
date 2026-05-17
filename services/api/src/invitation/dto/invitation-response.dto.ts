import { ApiProperty } from '@nestjs/swagger';

export class InvitationResponseDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}
