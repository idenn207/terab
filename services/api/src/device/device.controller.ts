import { Controller, Headers, HttpStatus } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import { DeviceService } from './device.service';

@Controller()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @TsRestHandler(contract.device.register)
  handleRegister(@CurrentUser() user: AuthUser, @Headers('user-agent') userAgent?: string) {
    return tsRestHandler(contract.device.register, async ({ body }) => {
      await this.deviceService.register(user.userId, body.pushToken, userAgent);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @TsRestHandler(contract.device.list)
  handleList(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.device.list, async () => {
      const result = await this.deviceService.findAll(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.device.remove)
  handleRemove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.device.remove, async ({ params }) => {
      await this.deviceService.remove(params.id, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}
