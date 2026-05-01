import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { deviceContract } from './device.contract';
import { invitationContract } from './invitation.contract';
import { trustedDeviceContract } from './trusted-device.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
  device: deviceContract,
  trustedDevice: trustedDeviceContract,
});

export { authContract, deviceContract, invitationContract, trustedDeviceContract, twofaContract };
