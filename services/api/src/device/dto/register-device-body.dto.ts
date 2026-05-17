import { IsString, MinLength } from 'class-validator';

export class RegisterDeviceBodyDto {
  @IsString()
  @MinLength(1)
  pushToken!: string;
}
