import { ApiProperty } from '@nestjs/swagger';

export class ValidateInvitationResponseDto {
  @ApiProperty()
  valid!: boolean;
}
