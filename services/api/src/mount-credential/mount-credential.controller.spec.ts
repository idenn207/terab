import { Test } from '@nestjs/testing';
import type { AuthUser } from '@terab/common';
import { MountCredentialController } from './mount-credential.controller';
import { MountCredentialService } from './mount-credential.service';

const user: AuthUser = {
  userId: 'user-1',
  username: 'me',
  roles: [],
  permissions: [],
} as unknown as AuthUser;

describe('MountCredentialController', () => {
  let controller: MountCredentialController;
  const service = {
    issue: jest.fn(),
    listActive: jest.fn(),
    revoke: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MountCredentialController],
      providers: [{ provide: MountCredentialService, useValue: service }],
    }).compile();
    controller = module.get(MountCredentialController);
    jest.clearAllMocks();
  });

  it('POST 호출 시 service.issue 위임 + driveId 전달', async () => {
    const expected = { id: 'cred-1', password: 'pw', script: 'ps1' };
    service.issue.mockResolvedValue(expected);
    const result = await controller.issue(user, { driveId: 'drive-1' });
    expect(service.issue).toHaveBeenCalledWith('user-1', 'drive-1');
    expect(result).toBe(expected);
  });

  it('GET 호출 시 service.listActive 위임', async () => {
    service.listActive.mockResolvedValue([]);
    const result = await controller.list(user);
    expect(service.listActive).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([]);
  });

  it('DELETE 호출 시 service.revoke 위임', async () => {
    service.revoke.mockResolvedValue(undefined);
    await controller.revoke(user, 'cred-1');
    expect(service.revoke).toHaveBeenCalledWith('user-1', 'cred-1');
  });
});
