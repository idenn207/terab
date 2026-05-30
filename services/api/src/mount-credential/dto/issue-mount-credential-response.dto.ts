import { ApiProperty } from '@nestjs/swagger';
import { MountCredentialDto } from './mount-credential.dto';

export class IssueMountCredentialResponseDto extends MountCredentialDto {
  @ApiProperty({
    description: '1회용 CHAP secret. 다음 GET 응답에는 미포함 — 즉시 안전한 곳에 보관해야 한다.',
  })
  password!: string;

  @ApiProperty({
    description: '1회용 PowerShell 마운트 스크립트 본문. UTF-8 / CRLF.',
  })
  script!: string;
}
