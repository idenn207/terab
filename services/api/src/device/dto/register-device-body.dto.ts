import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  pushToken!: string;
}
