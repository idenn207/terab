# Backup Code 재발급 Controller 추가

작성일: 2026-05-19
대상: services/api (auth + backup-code)
유형: missing feature (controller 누락 복구)

## 1. 배경

backup code는 register 시점에 8개가 1회 발급된다 (`auth.service.ts:67-68`, `findUnusedBackupCodes` + `markBackupCodeUsed`). 그러나 다음 상황에 대응할 수 없다.

- 사용자가 backup code를 분실
- 코드를 거의 다 소비해 추가 발급 필요
- 보안 사고로 일괄 재발급 필요

`grep -rn` 결과 backup code 관련 endpoint는 `POST /auth/login/backup`(소비)와 register 시 발급뿐이다. 재발급 endpoint가 없다. ts-rest 제거 마이그레이션 phase에서 누락된 것으로 보인다.

## 2. 요구사항

### 2.1 기능

- 인증된 사용자가 자신의 backup code를 재발급
- 재발급 시 기존 unused code는 모두 폐기 (consumed 처리)
- 새 코드 8개 생성·DB 저장 후 평문 1회 응답
- 재발급은 **현재 비밀번호 재확인**을 요구 (소유 증명)

### 2.2 보안 정책

| 항목 | 정책 |
|---|---|
| 호출자 인증 | JWT (`@CurrentUser` 필요) |
| 비밀번호 재확인 | request body의 `currentPassword`로 검증, 실패 시 `INVALID_CREDENTIALS` |
| 기존 코드 처리 | 모두 `usedAt = now()` 처리 (사용된 것으로 마킹) — DELETE 대신 마킹으로 감사 추적 보존 |
| 응답 코드 | 새 raw codes (평문) — 1회성 노출 |
| Throttle | 60초당 3회 (느슨하지만 brute force·DoS 차단) |

### 2.3 응답 표현

```
POST /auth/backup-codes/regenerate
Body: { currentPassword: string }

200 OK
{ backupCodes: string[8] }
```

400 (비밀번호 불일치): `INVALID_CREDENTIALS`

## 3. 변경 범위

### 3.1 Controller

`AuthController`에 메서드 추가 (`services/api/src/auth/auth.controller.ts`).

```ts
@Post('backup-codes/regenerate')
@HttpCode(HttpStatus.OK)
@Throttle({ default: { ttl: 60000, limit: 3 } })
@ApiOperation({ summary: 'Backup Code 재발급 — 기존 unused 폐기 후 8개 신규 발급' })
@ApiResponse({ status: HttpStatus.OK, type: BackupCodeRegenerateResponseDto })
@ApiError('INVALID_CREDENTIALS')
async regenerateBackupCodes(
  @CurrentUser() user: AuthUser,
  @Body() body: BackupCodeRegenerateBodyDto,
): Promise<BackupCodeRegenerateResponseDto> {
  const backupCodes = await this.authService.regenerateBackupCodes(user.userId, body.currentPassword);
  return { backupCodes };
}
```

데코레이터 순서는 `services/api/.claude/rules/layer-controller.md` 준수.

### 3.2 DTO

`services/api/src/auth/dto/`에 추가:

- `backup-code-regenerate-body.dto.ts`
  - `currentPassword!: string` + `@IsString() @MinLength(1) @MaxLength(255)`
- `backup-code-regenerate-response.dto.ts`
  - `backupCodes!: string[]`

### 3.3 Service

`AuthService.regenerateBackupCodes(userId, currentPassword)`:

```ts
async regenerateBackupCodes(userId: string, currentPassword: string): Promise<string[]> {
  const user = await this.authRepository.findUserWithPermissionsById(userId);
  if (!user) throw new ApiException('INVALID_CREDENTIALS');
  await this.validateCredentials(user, currentPassword); // 기존 메서드 재사용

  const rawCodes = this.generateBackupCodes();              // 기존 private 메서드 재사용
  const codeHashes = await Promise.all(
    rawCodes.map((code) => bcrypt.hash(code, this.BCRYPT_ROUNDS)),
  );

  await this.runInTx(async () => {
    await this.authRepository.invalidateAllBackupCodes(userId, new Date());
    await this.authRepository.insertBackupCodes(userId, codeHashes);
  });
  return rawCodes;
}
```

### 3.4 Repository

`AuthRepository`에 신규 메서드:

```ts
async invalidateAllBackupCodes(userId: string, usedAt: Date): Promise<void> {
  await this.conn
    .update(backupCodes)
    .set({ usedAt })
    .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
}
```

### 3.5 ErrorCode

추가 ErrorCode 없음 — `INVALID_CREDENTIALS` 재사용.

## 4. 테스트

### 4.1 단위 (AuthService.regenerateBackupCodes)

- 존재하지 않는 userId → `INVALID_CREDENTIALS` 던짐
- 비밀번호 불일치 → `INVALID_CREDENTIALS` 던짐
- 정상: `invalidateAllBackupCodes` 호출 + `insertBackupCodes` 호출 + 8개 코드 반환
- 트랜잭션 검증: 두 호출이 동일 tx에서 일어남

### 4.2 단위 (AuthRepository.invalidateAllBackupCodes)

- userId에 해당하는 unused code가 모두 `usedAt`로 마킹됨
- 이미 used인 code는 영향 없음

### 4.3 e2e

- register → 코드 1개 소비 → regenerate → 기존 unused 코드로 login 실패 (`BACKUP_CODE_INVALID`)
- regenerate 응답의 새 코드로 login 성공

## 5. 스코프 외

- 재발급 시 알림(이메일·푸시) — 별도 spec
- 재발급 횟수 제한(예: 일별 5회) — Throttle decorator로 1차 방어. 추가 정책은 별도 spec
- 재구조화 5 적용 후 본 controller가 `backup-code/` 도메인으로 이동할 가능성 — 재구조화 spec에서 일괄 처리

## 6. 종속

본 spec은 재구조화 5와 독립적으로 진행 가능. 단 두 spec이 동시에 진행되면 위치 충돌이 발생하므로 **재구조화 5보다 먼저 종료**한다. 종료 시점의 위치는 `auth/`이며, 재구조화 시 함께 이동된다.

## 7. 작업 산출물 체크리스트

- [ ] DTO 2개 추가 (`backup-code-regenerate-body.dto.ts`, `backup-code-regenerate-response.dto.ts`) + `dto/index.ts` re-export
- [ ] `AuthRepository.invalidateAllBackupCodes` 추가 + spec
- [ ] `AuthService.regenerateBackupCodes` 추가 + spec
- [ ] `AuthController.regenerateBackupCodes` 추가 + spec
- [ ] e2e 테스트 추가
- [ ] 기존 테스트 통과
- [ ] web 측 mutation wrapper + UI는 본 spec 외 (frontend-design 단계)
