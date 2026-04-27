import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mockConfigService } from '@terab/test';
import { TokenService } from './token.service';

const mockJwtService = {
  sign: jest.fn(),
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(TokenService);
    jest.clearAllMocks();
  });

  describe('초기화', () => {
    it('config 값으로 accessExpMs, refreshExpMs를 설정한다', () => {
      expect(service.accessExpMs).toBe(900000);
      expect(service.refreshExpMs).toBe(604800000);
    });
  });

  describe('generateAccessToken', () => {
    it('JwtService.sign을 올바른 페이로드와 만료 옵션으로 호출하고 토큰을 반환한다', () => {
      mockJwtService.sign.mockReturnValue('mock.jwt.token');

      const token = service.generateAccessToken('user-id', 'user1', ['FILE_READ']);

      expect(token).toBe('mock.jwt.token');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-id', username: 'user1', permissions: ['FILE_READ'] },
        { expiresIn: 900 }, // 900000ms → 900s
      );
    });
  });

  describe('issueRefreshToken', () => {
    it('rawRefreshToken, tokenHash, expiresAt을 반환한다', () => {
      const before = Date.now();
      const result = service.issueRefreshToken();
      const after = Date.now();

      expect(typeof result.rawRefreshToken).toBe('string');
      expect(result.rawRefreshToken.length).toBeGreaterThan(0);
      expect(result.tokenHash).toBe(service.hashToken(result.rawRefreshToken));
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 604800000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 604800000);
    });

    it('호출마다 서로 다른 rawRefreshToken을 생성한다', () => {
      const { rawRefreshToken: token1 } = service.issueRefreshToken();
      const { rawRefreshToken: token2 } = service.issueRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('pepperPassword', () => {
    it('동일 입력에 항상 같은 해시를 반환한다', () => {
      const hash1 = service.pepperPassword('my-password');
      const hash2 = service.pepperPassword('my-password');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('다른 입력은 다른 해시를 반환한다', () => {
      expect(service.pepperPassword('password-a')).not.toBe(service.pepperPassword('password-b'));
    });
  });

  describe('hashToken', () => {
    it('동일 입력에 항상 같은 해시를 반환한다', () => {
      const hash1 = service.hashToken('some-token');
      const hash2 = service.hashToken('some-token');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('다른 입력은 다른 해시를 반환한다', () => {
      expect(service.hashToken('token-a')).not.toBe(service.hashToken('token-b'));
    });
  });
});
