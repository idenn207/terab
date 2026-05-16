import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { deviceContract } from './device.contract';
import { fileContract } from './file.contract';
import { folderContract } from './folder.contract';
import { invitationContract } from './invitation.contract';
import { trashContract } from './trash.contract';
import { trustedDeviceContract } from './trusted-device.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
  device: deviceContract,
  trustedDevice: trustedDeviceContract,
  folder: folderContract,
  file: fileContract,
  trash: trashContract,
});

export {
  authContract,
  deviceContract,
  fileContract,
  folderContract,
  invitationContract,
  trashContract,
  trustedDeviceContract,
  twofaContract,
};
