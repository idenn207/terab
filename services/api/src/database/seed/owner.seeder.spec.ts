import { ConfigService } from '@nestjs/config';
import { TokenService } from '@terab/security';
import bcrypt from 'bcryptjs';
import { OwnerSeeder } from './owner.seeder';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  hash: jest.fn(),
}));

const mockConfig = {
  get: jest.fn(),
};

const mockToken = {
  pepperPassword: jest.fn(),
};

function buildDb(
  overrides: {
    existingUser?: { id: string } | null;
    ownerRole?: { id: string } | null;
    insertUserImpl?: () => Promise<Array<{ id: string }>>;
    insertUserRoleImpl?: () => Promise<unknown>;
  } = {},
) {
  const { existingUser = null, ownerRole = { id: 'role-owner' } } = overrides;
  const insertUserReturning = jest
    .fn()
    .mockImplementation(overrides.insertUserImpl ?? (() => Promise.resolve([{ id: 'new-owner' }])));
  const insertUserRoleValues = jest
    .fn()
    .mockImplementation(overrides.insertUserRoleImpl ?? (() => Promise.resolve(undefined)));

  let selectCallCount = 0;
  const limitFn = jest.fn().mockImplementation(() => {
    selectCallCount += 1;
    if (selectCallCount === 1) return Promise.resolve(existingUser ? [existingUser] : []);
    return Promise.resolve(ownerRole ? [ownerRole] : []);
  });

  let insertCallCount = 0;
  const insertFn = jest.fn().mockImplementation(() => {
    insertCallCount += 1;
    if (insertCallCount === 1) {
      return {
        values: jest.fn().mockReturnValue({ returning: insertUserReturning }),
      };
    }
    return { values: insertUserRoleValues };
  });

  return {
    db: {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ limit: limitFn }),
        }),
      }),
      insert: insertFn,
    },
    insertUserReturning,
    insertUserRoleValues,
    insertFn,
  };
}

describe('OwnerSeeder', () => {
  let seeder: OwnerSeeder;

  beforeEach(() => {
    seeder = new OwnerSeeder(mockConfig as unknown as ConfigService, mockToken as unknown as TokenService);
    jest.clearAllMocks();
    mockToken.pepperPassword.mockReturnValue('peppered');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  it('인스턴스가 생성된다', () => {
    expect(seeder).toBeDefined();
  });

  describe('seed', () => {
    it('OWNER_PASSWORD가 설정되지 않으면 아무 것도 하지 않는다', async () => {
      mockConfig.get.mockReturnValue(undefined);
      const { db, insertFn } = buildDb();

      await seeder.seed(db as never);

      expect(insertFn).not.toHaveBeenCalled();
    });

    it('동일 username의 owner가 이미 존재하면 insert를 건너뛴다', async () => {
      mockConfig.get.mockImplementation((key: string) => (key === 'OWNER_PASSWORD' ? 'pwd' : undefined));
      const { db, insertFn } = buildDb({ existingUser: { id: 'existing-owner' } });

      await seeder.seed(db as never);

      expect(insertFn).not.toHaveBeenCalled();
    });

    it('OWNER role이 DB에 없으면 명확한 Error를 던진다', async () => {
      mockConfig.get.mockImplementation((key: string) => (key === 'OWNER_PASSWORD' ? 'pwd' : undefined));
      const { db } = buildDb({ ownerRole: null });

      await expect(seeder.seed(db as never)).rejects.toThrow(/OWNER role 없음/);
    });

    it('users insert가 UNIQUE 충돌(23505)을 던지면 swallow한다 (동시 기동 보호)', async () => {
      mockConfig.get.mockImplementation((key: string) => (key === 'OWNER_PASSWORD' ? 'pwd' : undefined));
      const { db, insertUserRoleValues } = buildDb({
        insertUserImpl: () => Promise.reject({ code: '23505' }),
      });

      await expect(seeder.seed(db as never)).resolves.toBeUndefined();
      expect(insertUserRoleValues).not.toHaveBeenCalled();
    });

    it('UNIQUE 외의 DB 오류는 그대로 전파한다', async () => {
      mockConfig.get.mockImplementation((key: string) => (key === 'OWNER_PASSWORD' ? 'pwd' : undefined));
      const { db } = buildDb({
        insertUserImpl: () => Promise.reject({ code: '40001' }),
      });

      await expect(seeder.seed(db as never)).rejects.toMatchObject({ code: '40001' });
    });

    it('정상 경로에서 pepper → bcrypt → users insert → user_roles insert 순으로 호출한다', async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'OWNER_PASSWORD') return 'pwd';
        if (key === 'OWNER_USERNAME') return 'admin';
        if (key === 'OWNER_NICKNAME') return '관리자';
        return undefined;
      });
      const { db, insertUserReturning, insertUserRoleValues } = buildDb();

      await seeder.seed(db as never);

      expect(mockToken.pepperPassword).toHaveBeenCalledWith('pwd');
      expect(bcrypt.hash).toHaveBeenCalledWith('peppered', 10);
      expect(insertUserReturning).toHaveBeenCalled();
      expect(insertUserRoleValues).toHaveBeenCalledWith({
        userId: 'new-owner',
        roleId: 'role-owner',
      });
    });
  });
});
