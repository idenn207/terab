import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ description: 'ErrorCode 키 또는 일반화된 코드(HTTP_ERROR, INTERNAL_SERVER_ERROR)' })
  code!: string;

  @ApiProperty({ description: '사용자 노출 메시지' })
  message!: string;
}
