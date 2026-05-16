import { Controller, Headers, HttpStatus, Res } from '@nestjs/common';
import { type AuthUser, CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { Response } from 'express';
import { TrustedDeviceService } from './trusted-device.service';

@Controller()
export class TrustedDeviceController {
  private readonly TRUST_TOKEN_COOKIE = 'trustToken';
  private readonly COOKIE_PATH = '/';

  constructor(private readonly trustedDeviceService: TrustedDeviceService) {}

  @TsRestHandler(contract.trustedDevice.list)
  handleList(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trustedDevice.list, async () => {
      const result = await this.trustedDeviceService.findAll(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.trustedDevice.register)
  handleRegister(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return tsRestHandler(contract.trustedDevice.register, async () => {
      const rawToken = await this.trustedDeviceService.register(user.userId, userAgent);
      res.cookie(this.TRUST_TOKEN_COOKIE, rawToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: this.trustedDeviceService.trustDurationMs,
        path: this.COOKIE_PATH,
      });
      return { status: HttpStatus.CREATED, body: undefined };
    });
  }

  @TsRestHandler(contract.trustedDevice.revoke)
  handleRevoke(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trustedDevice.revoke, async ({ params }) => {
      await this.trustedDeviceService.revoke(params.id, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}
