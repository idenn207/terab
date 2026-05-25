# Auth/User 책임 분리 설계 (2026-05-20)

## 1. 배경 및 목표

현재 `src/auth/`가 너무 많은 책임을 가진다.

- 자격증명 검증, 토큰 발급, 권한 합성, 쿠키 관리 (인증 primitive)
- register / login / refresh / logout / me 흐름 (controller-facing public API)
- 백업코드 재발급 흐름 (자격증명 검증 + 백업코드 도메인)

본 설계는 책임을 다음과 같이 재배치한다.

- **`auth/`**: 자격증명 검증, 토큰 발급/회전/폐기, refreshToken/trustToken 쿠키 관리. controller 없음. role/session 도메인을 sub-module로 흡수.
- **`user/`**: 사용자 lifecycle 흐름(register/login/refresh/logout/me) entry point. 디바이스/신뢰기기 검사 후 AuthService에 위임. UserController가 root 경로(`/login`, `/refresh`, ...)로 노출.
- **`twofa/`**: 챌린지 상태/응답/완료 + backup-code 재발급 엔드포인트 흡수. `getStatus`는 userId+status만 반환하고, accessToken 발급은 호출자(ChallengeController → UserService)가 조립.
- **`trusted-device/`**: controller 유지. trustToken 쿠키 write만 AuthService에 위임.

## 2. 의존성 그래프 (단방향)

```
UserController ──► UserService ─┬─► AuthService ──┬─► TokenService    (@terab/security)
                                │                 ├─► SessionService  (src/auth/session/)
                                │                 └─► RoleService     (src/auth/role/)
                                ├─► TwoFaService
                                ├─► DeviceService
                                ├─► TrustedDeviceService
                                ├─► BackupCodeService
                                ├─► InvitationService
                                ├─► PushChallengePublisher
                                └─► UserRepository

ChallengeController ──► TwoFaService
                    └─► UserService                 (issueAfterTwoFa)

BackupCodeController ──► UserService                (findById)
                    └─► AuthService                 (validateCredentials)
                    └─► BackupCodeService           (regenerateForUser)

TrustedDeviceController ──► TrustedDeviceService
                        └─► AuthService             (setTrustCookie만)
```

- AuthService는 어떤 도메인 service도 의존하지 않음 (TokenService/SessionService/RoleService는 인증 sub-modules)
- TwoFaService는 leaf — UserService를 의존하지 않음 (getStatus는 userId만 반환)
- AuthModule ↔ TwoFaModule 순환 없음

## 3. 디렉토리 구조

### 변경 후

```
src/auth/
  auth.module.ts            ← role/session sub-module 흡수, controller 없음
  auth.service.ts
  auth.service.spec.ts
  strategies/jwt.strategy.ts
  role/                     ← src/role/에서 이동
    role.module.ts
    role.service.ts
    role.service.spec.ts
    role.repository.ts
    role.repository.spec.ts
  session/                  ← src/session/에서 이동
    session.module.ts
    session.service.ts
    session.service.spec.ts
    session.repository.ts
    session.repository.spec.ts

src/user/
  user.module.ts
  user.controller.ts        ← 신규
  user.controller.spec.ts   ← 신규
  user.service.ts
  user.service.spec.ts
  user.repository.ts
  user.repository.spec.ts
  dto/                      ← src/auth/dto/에서 이관
    register-body.dto.ts
    register-response.dto.ts
    login-body.dto.ts
    backup-login-body.dto.ts
    login-response.dto.ts
    authenticated-response.dto.ts
    twofa-required-response.dto.ts
    index.ts

src/twofa/
  backup-code.controller.ts ← 신규
  backup-code.controller.spec.ts
  dto/
    backup-code-regenerate-body.dto.ts        ← src/auth/dto/에서 이관
    backup-code-regenerate-response.dto.ts    ← src/auth/dto/에서 이관

src/trusted-device/
  trusted-device.controller.ts ← cookie 상수 제거, AuthService.setTrustCookie 호출
```

### 삭제

- `src/auth/auth.controller.ts`
- `src/auth/auth.controller.spec.ts`
- `src/auth/dto/` 전체 (각 DTO는 user/twofa로 이관)
- `src/auth/types/user-with-permissions.type.ts` (`UserWithPermissions` 합성 객체 폐기)
- `src/role/` (이동)
- `src/session/` (이동)

## 4. AuthService API

```ts
@Injectable()
export class AuthService extends ServiceCore {
  private readonly BCRYPT_ROUNDS = 10;
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly TRUST_TOKEN_COOKIE = 'trustToken';
  private readonly COOKIE_PATH = '/';

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly roleService: RoleService,
  ) { super(database, txContext); }

  // ─── 자격증명 ────────────────────────────────────────────────────
  async hashPassword(raw: string): Promise<string>;
  async validateCredentials(user: Pick<Users$Select, 'password' | 'active'>, raw: string): Promise<void>;
  //   INVALID_CREDENTIALS / ACCOUNT_DISABLED throw

  // ─── 역할 ──────────────────────────────────────────────────────
  async assignDefaultRole(userId: string): Promise<void>;
  //   RoleService.findByName('USER') + assignUserRole. ROLE_NOT_FOUND throw

  // ─── 토큰 발급 (cookie write 포함) ────────────────────────────────
  async generateAccessToken(user: Users$Select): Promise<string>;
  //   permissions 자체 조회 후 JWT sign

  async issueTokenPair(user: Users$Select, res: Response): Promise<{ accessToken: string }>;
  //   accessToken 발급 + RT 발급 + setRefreshCookie

  // ─── Refresh / Logout ────────────────────────────────────────────
  async rotateRefreshToken(rawRt: string | undefined, res: Response): Promise<{ userId: string }>;
  //   REFRESH_TOKEN_INVALID throw, sessionService.rotate + setRefreshCookie

  async revokeRefreshToken(rawRt: string | undefined, res: Response): Promise<void>;
  //   sessionService.revokeByRawToken + clearRefreshCookie. rawRt undefined면 cookie clear만

  // ─── Cookie 헬퍼 (외부 controller에서 호출) ─────────────────────
  setTrustCookie(res: Response, rawToken: string, maxAgeMs: number): void;
  clearTrustCookie(res: Response): void;

  // ─── 내부 private cookie 작성 ────────────────────────────────────
  private setRefreshCookie(res: Response, rawToken: string, maxAgeMs: number): void;
  private clearRefreshCookie(res: Response): void;
}
```

### 설계 메모

- `validateCredentials` 인자는 `Pick<Users$Select, 'password' | 'active'>`로 좁힌다. `UserWithPermissions` 합성 객체 불필요.
- `generateAccessToken`은 비동기 — 내부에서 `RoleService.getPermissionsByUserId` 호출.
- `rotateRefreshToken`은 `{ userId }`만 반환. 호출자(UserService)가 user 조회 후 `generateAccessToken`을 호출하는 2-step 패턴 — AuthService가 UserService에 의존하지 않게 하기 위함.
- `revokeRefreshToken`은 `rawRt: undefined` 입력도 허용(logout idempotent).

## 5. UserController + UserService API

### UserController

```ts
@Controller()
@ApiTags('User')
@ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public() @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '회원가입 — 초대 토큰 소비 후 RT 쿠키 설정' })
  @ApiResponse({ status: HttpStatus.CREATED, type: RegisterResponseDto })
  @ApiError('INVITATION_NOT_FOUND', 'INVITATION_EXPIRED', 'INVITATION_ALREADY_USED',
            'USERNAME_TAKEN', 'REGISTRATION_FAILED', 'ROLE_NOT_FOUND')
  async register(@Body() body, @Res({ passthrough: true }) res): Promise<RegisterResponseDto>;

  @Public() @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login') @HttpCode(HttpStatus.OK)
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('INVALID_CREDENTIALS', 'ACCOUNT_DISABLED')
  async login(
    @Body() body,
    @Cookies('trustToken') trustToken,
    @Headers('user-agent') ua,
    @Res({ passthrough: true }) res,
  ): Promise<LoginResponse>;

  @Public() @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login/backup') @HttpCode(HttpStatus.OK)
  @ApiError('INVALID_CREDENTIALS', 'BACKUP_CODE_INVALID', 'ACCOUNT_DISABLED')
  async loginWithBackup(@Body() body, @Res({ passthrough: true }) res): Promise<LoginResponse>;

  @Public()
  @Post('refresh') @HttpCode(HttpStatus.OK)
  @ApiError('REFRESH_TOKEN_INVALID')
  async refresh(@Req() req, @Res({ passthrough: true }) res): Promise<LoginResponse>;

  @Public()
  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req, @Res({ passthrough: true }) res): Promise<void>;

  @Get('me')
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiError('INVALID_CREDENTIALS')
  async me(@CurrentUser() user: AuthUser): Promise<UserDto>;
}
```

- URL 경로: `POST /register`, `/login`, `/login/backup`, `/refresh`, `/logout`, `GET /me`
- 기존 `/auth/*` 접두사 제거. web codegen 재생성 필요.

### UserService

```ts
@Injectable()
export class UserService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly twoFaService: TwoFaService,
    private readonly deviceService: DeviceService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly backupCodeService: BackupCodeService,
    private readonly invitationService: InvitationService,
    private readonly pushChallengePublisher: PushChallengePublisher,
  ) { super(database, txContext); }

  // ─── 사용자 조회 (기존 유지) ─────────────────────────────────────
  async findById(id: string): Promise<Users$Select | null>;
  async findByUsername(username: string): Promise<Users$Select | null>;

  // ─── Register ──────────────────────────────────────────────────
  @LogReplay()
  async register(body: RegisterBodyDto, res: Response): Promise<RegisterResponseDto>;
  //   runInTx:
  //     invitationService.validateOrThrow
  //     hashed = authService.hashPassword
  //     { id } = userRepository.insert  (USERNAME_TAKEN catch)
  //     authService.assignDefaultRole(id)
  //     rawCodes = backupCodeService.generateForUser(id)
  //     invitationService.consume
  //   user = userRepository.findById(id) (REGISTRATION_FAILED if null)
  //   { accessToken } = authService.issueTokenPair(user, res)
  //   return { accessToken, user, backupCodes: rawCodes }

  // ─── Login ─────────────────────────────────────────────────────
  @LogReplay({ captureResult: true })
  async login(
    body: LoginBodyDto,
    trustToken: string | undefined,
    userAgent: string | undefined,
    res: Response,
  ): Promise<LoginResponse>;
  //   user = findByUsername (INVALID_CREDENTIALS if null)
  //   authService.validateCredentials(user, body.password)
  //   if trustToken && trustedDeviceService.verify(...):  → issueTokenPair → AUTHENTICATED
  //   pushTokens = deviceService.findPushTokensByUserId(user.id)
  //   if pushTokens.length === 0:                          → issueTokenPair → AUTHENTICATED
  //   challenge = twoFaService.createChallenge(user.id)
  //   publish push events
  //   return { status: '2FA_REQUIRED', challengeId, options, expiresAt }

  async loginWithBackupCode(body: BackupLoginBodyDto, res: Response): Promise<LoginResponse>;
  //   user = findByUsername → validateCredentials → backupCodeService.consume → issueTokenPair

  // ─── Refresh / Logout ──────────────────────────────────────────
  @LogReplay({ captureResult: true })
  async refresh(rawRt: string | undefined, res: Response): Promise<LoginResponse>;
  //   { userId } = authService.rotateRefreshToken(rawRt, res)
  //   user = userRepository.findById(userId) (REFRESH_TOKEN_INVALID if null)
  //   accessToken = authService.generateAccessToken(user)
  //   return { status: 'AUTHENTICATED', accessToken, user }

  @LogReplay()
  async logout(rawRt: string | undefined, res: Response): Promise<void>;
  //   authService.revokeRefreshToken(rawRt, res)

  // ─── Me ────────────────────────────────────────────────────────
  async getMe(userId: string): Promise<UserDto>;
  //   user = findById (INVALID_CREDENTIALS if null)
  //   return { id, username, nickname }

  // ─── 2FA 완료 후 인증 응답 조립 (ChallengeController가 호출) ──────
  async issueAfterTwoFa(userId: string, res: Response): Promise<LoginResponse>;
  //   user = findById (TWOFA_CHALLENGE_NOT_FOUND if null)
  //   { accessToken } = authService.issueTokenPair(user, res)
  //   return { status: 'AUTHENTICATED', accessToken, user }
}
```

## 6. TwoFa 변경

### TwoFaService.getStatus

```ts
// 변경 후: APPROVED 시 userId만 반환, accessToken 발급 없음
async getStatus(challengeId: string): Promise<ChallengeStatusResponse> {
  const challenge = await this.twoFaRepository.findById(challengeId);
  if (!challenge) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');

  if (challenge.status === 'PENDING' && challenge.expiresAt <= new Date()) {
    await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
    return { status: 'EXPIRED' };
  }

  if (challenge.status === 'PENDING') {
    return {
      status: 'PENDING',
      options: challenge.options.split(','),
      correctNum: challenge.correctNum,
      remainingSeconds: Math.max(0, Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000)),
    };
  }

  if (challenge.status === 'APPROVED') {
    return { status: 'APPROVED', userId: challenge.userId };
  }

  return { status: 'DENIED' };
}
```

### 제거 대상

- `TwoFaRepository.findUserWithPermissionsById`
- `TwoFaService.issueAuthenticatedResponse` (placeholder)
- `TwoFaService`의 `TokenService` 의존성

### ChallengeStatusApprovedDto 변경

```ts
// 변경 전: { status, accessToken, user }
// 변경 후: { status, userId }
export class ChallengeStatusApprovedDto {
  status!: 'APPROVED';
  @ApiProperty({ format: 'uuid' })
  userId!: string;
}
```

> 클라이언트 변경: getStatus 응답만으로 인증 완료 불가. 별도로 `POST /2fa/challenge/:id/complete` 호출 후 accessToken 수신.

### ChallengeController.complete

```ts
@Public()
@Post(':id/complete')
@HttpCode(HttpStatus.OK)
async complete(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() body: CompleteChallengeBodyDto,
  @Res({ passthrough: true }) res: Response,
): Promise<LoginResponse> {
  const userId = await this.twoFaService.completeChallenge(id, body);
  return this.userService.issueAfterTwoFa(userId, res);
}
```

ChallengeController는 `UserService`를 신규 의존. TwoFaModule이 UserModule을 import.

> UserModule도 TwoFaModule을 import해야 하므로 NestJS `forwardRef` 사용. 또는 `UserService.issueAfterTwoFa`를 별도 “인증 응답 조립” 책임만 가진 작은 서비스로 분리하는 안도 있지만, 본 설계는 단순성을 위해 forwardRef를 채택.

### BackupCodeController (신규)

```ts
@Controller('backup-codes')
@ApiTags('TwoFa')
export class BackupCodeController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly backupCodeService: BackupCodeService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('regenerate') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backup Code 재발급' })
  @ApiResponse({ status: HttpStatus.OK, type: BackupCodeRegenerateResponseDto })
  @ApiError('INVALID_CREDENTIALS')
  async regenerate(
    @CurrentUser() user: AuthUser,
    @Body() body: BackupCodeRegenerateBodyDto,
  ): Promise<BackupCodeRegenerateResponseDto> {
    const dbUser = await this.userService.findById(user.userId);
    if (!dbUser) throw new ApiException('INVALID_CREDENTIALS');
    await this.authService.validateCredentials(dbUser, body.currentPassword);
    const backupCodes = await this.backupCodeService.regenerateForUser(user.userId);
    return { backupCodes };
  }
}
```

- URL: `/auth/backup-codes/regenerate` → `/backup-codes/regenerate`
- DTO 두 개를 `src/twofa/dto/`로 이관

## 7. TrustedDeviceController 변경

```ts
@Controller('trusted-device')
@ApiTags('TrustedDevice')
export class TrustedDeviceController {
  // TRUST_TOKEN_COOKIE / COOKIE_PATH 상수 제거 — AuthService가 소유

  constructor(
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly authService: AuthService,  // 신규
  ) {}

  @Post()
  async register(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = await this.trustedDeviceService.register(user.userId, userAgent);
    this.authService.setTrustCookie(res, rawToken, this.trustedDeviceService.trustDurationMs);
  }

  // list, revoke는 그대로
}
```

TrustedDeviceModule이 AuthModule을 import.

## 8. 모듈 구성 변경

### AppModule

```ts
imports: [
  ...,
  UserModule,
  AuthModule,        // RoleModule/SessionModule 흡수
  DeviceModule,
  TrustedDeviceModule,
  TwoFaModule,
  InvitationModule,
  ...,
]
// RoleModule, SessionModule import 제거
```

### AuthModule

```ts
@Module({
  imports: [
    PassportModule,
    RoleModule,        // src/auth/role/
    SessionModule,     // src/auth/session/
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, RoleModule, SessionModule],
})
export class AuthModule {}
```

### UserModule

```ts
@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    AuthModule,
    forwardRef(() => TwoFaModule),
    DeviceModule,
    TrustedDeviceModule,
    InvitationModule,
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
```

### TwoFaModule

```ts
@Module({
  imports: [
    ...,
    forwardRef(() => UserModule),   // ChallengeController가 UserService 사용
    AuthModule,                     // BackupCodeController가 AuthService 사용
  ],
  controllers: [
    ChallengeController,
    BackupCodeController,           // 신규
    TwoFaController,                // (기존)
    TotpController,                 // (기존)
  ],
  providers: [
    TwoFaService, TwoFaRepository, BackupCodeService, BackupCodeRepository, ...
  ],
  exports: [TwoFaService, BackupCodeService],
})
export class TwoFaModule {}
```

### TrustedDeviceModule

```ts
@Module({
  imports: [..., AuthModule],
  controllers: [TrustedDeviceController],
  providers: [...],
  exports: [TrustedDeviceService],
})
```

## 9. ErrorCode 추가/변경

기존 ErrorCode 유지. 새로 추가 없음.

## 10. 테스트 영향

### 신규 spec 파일

- `src/user/user.controller.spec.ts`
- `src/twofa/backup-code.controller.spec.ts`
- (기존 `src/auth/auth.service.spec.ts`는 새 시그니처에 맞춰 전면 재작성)

### 삭제 spec

- `src/auth/auth.controller.spec.ts`

### 영향 받는 spec

- `src/auth/auth.service.spec.ts` (전면 재작성 — 새 API)
- `src/user/user.service.spec.ts` (대폭 확장 — register/login/refresh/logout/me 추가)
- `src/twofa/twofa.service.spec.ts` (`getStatus` 결과 검증 변경, `findUserWithPermissionsById` mock 제거)
- `src/twofa/challenge.controller.spec.ts` (`complete` 흐름이 `userService.issueAfterTwoFa`로 변경)
- `src/twofa/twofa.repository.spec.ts` (`findUserWithPermissionsById` 케이스 제거)
- `src/trusted-device/trusted-device.controller.spec.ts` (cookie write 호출이 `authService.setTrustCookie`로 변경)
- `src/role/**/*.spec.ts` → `src/auth/role/**/*.spec.ts` 경로만 이동

### Fixture

- `UserWithPermissions`를 사용하던 fixture/mocks 제거. `mockUser`(`Users$Select`)만 사용.

## 11. CLAUDE.md / 룰 파일 갱신

- `services/api/CLAUDE.md` 모듈 표:
  - `src/auth/` 설명: "인증 (자격증명·토큰·쿠키 관리)로 변경"
  - `src/role/`, `src/session/` 라인 제거
  - `src/user/` 라인 추가 (controller-facing 흐름 entry point)
  - `src/twofa/`에 backup-code 컨트롤러 흡수 표기
- `services/api/CLAUDE.md` "도메인 간 의존 관계" 섹션에 다음 추가:
  - `UserModule → AuthModule, TwoFaModule(forwardRef), Device/TrustedDevice/Invitation, BackupCode`
  - `TwoFaModule → UserModule(forwardRef), AuthModule`
  - `TrustedDeviceModule → AuthModule`

## 12. Web codegen 영향

- 경로 변경: `/auth/*` → root (`/login`, `/register`, `/refresh`, `/logout`, `/me`, `/login/backup`)
- 경로 변경: `/auth/backup-codes/regenerate` → `/backup-codes/regenerate`
- 응답 변경: `ChallengeStatusApprovedDto` (`accessToken`, `user` 제거 → `userId`만)
  - 클라이언트는 `POST /2fa/challenge/:id/complete` 호출로 인증 응답 수신
- `PUBLIC_PATHS` 자동 갱신 — codegen 재실행 필요

## 13. 마이그레이션 순서 (구현 계획에서 상세화)

1. `src/role/`, `src/session/` 이동 — import 경로만 변경, 동작 그대로 (테스트 통과 확인)
2. AuthService 새 API 구현 + spec 재작성 (controller 미연결 상태)
3. UserService 확장 + UserController 추가, AppModule 등록
4. TwoFaService.getStatus / ChallengeStatusApprovedDto 변경, ChallengeController.complete 위임
5. BackupCodeController 신설, AuthController의 backup-codes 엔드포인트 제거
6. TrustedDeviceController cookie write 위임
7. AuthController, AuthService 옛 메서드, `UserWithPermissions` 타입, `TwoFaRepository.findUserWithPermissionsById` 제거
8. CLAUDE.md / web codegen 갱신

각 단계 후 `npm test`, `npm run build` 통과 확인.

## 14. 비목표 (Out of scope)

- 2FA fallback 전략(TOTP/passkey + sliding trustToken) — 별도 spec
- 화면(UI/UX) 설계 — 별도 frontend-design 단계
- Storage multi-tenant 확장(`drives` 테이블 도입) — 별도 spec
- service 메서드의 `@LogReplay` 정책 일괄 정비 — 본 설계는 controller-facing entry point에만 부착
