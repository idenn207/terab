import { ApiProperty } from '@nestjs/swagger';

export class TotpSetupPendingDto {
  @ApiProperty({ enum: ['PENDING'] })
  status!: 'PENDING';

  secret!: string;
  otpauthUri!: string;
}

export class TotpSetupEnrolledDto {
  @ApiProperty({ enum: ['ENROLLED'] })
  status!: 'ENROLLED';

  @ApiProperty({ format: 'uuid' })
  id!: string;
}

export type TotpSetupStartResponse = TotpSetupPendingDto | TotpSetupEnrolledDto;
