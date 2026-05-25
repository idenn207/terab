# 초대 기반 가입 설계 (DEV-017)

**요구사항:** AUTH-02
**범위:** API (invitation 도메인 + auth/register) + Web (RegisterPage + BackupCodeIssuePage) + Mobile (딥링크 핸들러)

---

## 1. 전체 구조

```
[Admin] POST /api/invitations (ADMIN 역할 + curl/Postman)
  → { url: "https://drive.skypark207.com/register/TOKEN" }

[초대받은 사용자]
  모바일에서 URL 클릭
  ├─ 앱 설치됨  → Universal Link(App Links) → 앱 직접 진입 (OS 레벨 분기)
  └─ 앱 미설치 → 브라우저 → 모바일 웹 폼 (폴백)

  데스크탑에서 URL 클릭
  └─ 브라우저 → 웹 가입 폼

[가입 완료]
  POST /api/auth/register
  → accessToken 발급 + USER 역할 부여 + 백업 코드 8개 생성
  → 백업 코드 발급 화면 (D-02a)
  → /drive 리다이렉트
```

**모바일 딥링크:** DEV-011에서 구성한 Universal Links(iOS) / App Links(Android)를 그대로 사용한다. `https://drive.skypark207.com/register/:token` URL이 OS 레벨에서 앱 설치 여부를 감지해 자동 분기하므로 JS redirect 없이 처리된다. 웹 폴백 페이지는 앱 미설치 사용자 전용이다.

---

## 2. DB 스키마

### 신규 테이블: `invitations`

```typescript
// services/api/src/database/schema/invitations.schema.ts
export const invitations = pgTable('invitations', {
  id:            uuid('id').primaryKey().defaultRandom(),
  token:         uuid('token').notNull().unique().defaultRandom(),
  createdBy:     uuid('created_by').notNull().references(() => users.id),
  usedBy:        uuid('used_by').references(() => users.id),
  usedAt:        timestamp('used_at', { withTimezone: true }),
  expiresAt:     timestamp('expires_at', { withTimezone: true }).notNull(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**유효한 초대 조건 (3가지 모두 충족):**

1. `usedAt IS NULL` — 미사용
2. `deactivatedAt IS NULL` — 비활성화 안 됨
3. `expiresAt > NOW()` — 만료 안 됨

`deactivatedAt` 타임스탬프 방식을 선택한 이유: 언제 비활성화됐는지 감사 이력이 남고, 기존 스키마(`trusted-devices`, `backup-codes`)의 타임스탬프 패턴과 일관성을 유지한다.

### Drizzle 마이그레이션

`schema/index.ts`에 `invitations` re-export 추가.
`npm run db:generate`로 마이그레이션 SQL 생성.

---

## 3. API 엔드포인트

### 3-1. `POST /api/invitations` — 초대 링크 생성

- **Guard:** `@RequirePermission('invitation:create')` (ADMIN 역할에 부여)
- **Body:** `{ expiresInDays?: number }` (기본값: 7)
- **Response 200:**

  ```json
  {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://drive.skypark207.com/register/550e8400-...",
    "expiresAt": "2026-05-05T00:00:00Z"
  }
  ```

### 3-2. `GET /api/invitations/:token` — 토큰 유효성 검증

- **Guard:** `@Public()`
- **Response 200:** `{ "valid": true }` or `{ "valid": false }`
- 만료·사용됨·비활성화 모두 `valid: false`로 통일 (토큰 존재 여부 노출 방지)

### 3-3. `DELETE /api/invitations/:token` — 초대 비활성화

- **Guard:** `@RequirePermission('invitation:delete')` (ADMIN 역할에 부여)
- **Action:** `deactivatedAt = NOW()`
- **Response:** 204 No Content
- 이미 비활성화된 토큰이면 그냥 204 반환 (멱등성 유지)

### 3-4. `POST /api/auth/register` — 회원가입 완료

- **Guard:** `@Public()`
- **Body:**

  ```json
  {
    "token": "550e8400-...",
    "username": "string (max 50)",
    "nickname": "string (max 100)",
    "password": "string (min 8)"
  }
  ```

- **처리 순서 (트랜잭션):**
  1. 토큰 유효성 검증 → 실패 시 에러
  2. `users` INSERT (password bcrypt 해싱)
  3. USER 역할 부여 (`user_roles` INSERT)
  4. 백업 코드 8개 생성 (기존 BackupCode 로직 재사용)
  5. `invitations.usedAt`, `invitations.usedBy` 업데이트
  6. accessToken + refreshToken 발급
- **Response 201:**

  ```json
  {
    "accessToken": "...",
    "user": { "id": "...", "username": "...", "nickname": "..." },
    "backupCodes": ["XXXX-XXXX", ...]
  }
  ```

### ErrorCode 추가 (3개)

```typescript
INVITATION_NOT_FOUND:     { message: '유효하지 않은 초대 링크입니다.', status: 404 }
INVITATION_EXPIRED:       { message: '만료된 초대 링크입니다.', status: 410 }
INVITATION_ALREADY_USED:  { message: '이미 사용된 초대 링크입니다.', status: 409 }
```

### RBAC 권한 시딩 추가

기존 `rbac.seed.ts`에 ADMIN 역할에 `invitation:create`, `invitation:delete` 권한 추가.

---

## 4. Web 플로우

### 라우트

```
/register/:token          → RegisterPage
/register/:token/backup   → BackupCodeIssuePage
```

기존 `services/web/src/pages/register/` 컴포넌트를 확장한다.

### RegisterPage 플로우

```
진입 시 GET /api/invitations/:token
  → valid: false → "유효하지 않은 초대 링크" 에러 화면 (재시도 불가)
  → valid: true  → 가입 폼 표시

폼 필드: username, nickname, password, password 확인

제출 → POST /api/auth/register
  → 성공 → accessToken을 AuthStore에 저장
           → navigate('/register/:token/backup', { state: { backupCodes } })
  → 실패 → 에러 메시지 인라인 표시 (폼 유지)
```

### BackupCodeIssuePage 플로우

```
register 응답의 backupCodes 8개 표시
"복사" 버튼 → 클립보드 복사 (전체 코드 개행 구분)
"완료" 버튼 → navigate('/drive')

주의: 백업 코드는 이 화면에서만 확인 가능 (재조회 API 없음)
      "완료" 버튼 클릭 전 이탈 시도 시 경고 모달 표시 ("백업 코드를 저장했나요?")
```

### FSD 슬라이스 구조

```
features/
  register-by-invitation/
    api/    invitationApi.ts   (GET /api/invitations/:token)
    api/    registerApi.ts     (POST /api/auth/register)
    model/  useRegister.ts     (폼 제출 훅)
    ui/     RegisterForm.tsx
    ui/     BackupCodeDisplay.tsx
    index.ts
pages/
  register/
    ui/  RegisterPage.tsx       (기존 파일 확장)
    ui/  BackupCodeIssuePage.tsx (기존 파일 확장)
```

---

## 5. Mobile (Capacitor) 딥링크 핸들러

DEV-011에서 구성된 App Links 설정에 `/register/:token` 경로 패턴을 추가한다.

```typescript
// 기존 딥링크 핸들러에 경로 추가
App.addListener('appUrlOpen', ({ url }) => {
  const path = new URL(url).pathname;  // "/register/TOKEN"
  router.navigate(path);               // React Router로 전달
});
```

웹과 동일한 `RegisterPage`를 Capacitor WebView에서 렌더링하므로 별도 모바일 UI 작업 없이 핸들러 라우팅 연결만 추가한다.

---

## 6. 파일 맵 요약

### API — 신규 생성

```
services/api/src/database/schema/invitations.schema.ts
services/api/src/invitation/
  invitation.repository.ts
  invitation.service.ts
  invitation.service.spec.ts
  invitation.controller.ts
  invitation.module.ts
  dto/create-invitation.dto.ts
  dto/invitation-response.dto.ts
```

### API — 수정

```
services/api/src/database/schema/index.ts       ← invitations re-export
services/api/src/common/exceptions/error-code.enum.ts  ← 3개 추가
services/api/src/auth/auth.service.ts           ← register() 메서드 추가
services/api/src/auth/auth.service.spec.ts      ← register 테스트
services/api/src/auth/auth.controller.ts        ← POST /api/auth/register
services/api/src/auth/auth.module.ts            ← InvitationModule import
services/api/src/app.module.ts                  ← InvitationModule 등록
services/api/src/database/seed/rbac.seed.ts     ← invitation 권한 추가
services/api/drizzle/                           ← 신규 마이그레이션 SQL
```

### Web — 수정

```
services/web/src/features/register-by-invitation/  ← 신규 슬라이스
services/web/src/pages/register/ui/RegisterPage.tsx
services/web/src/pages/register/ui/BackupCodeIssuePage.tsx
services/web/src/app/providers/router/config.tsx   ← /register/:token 라우트 추가
```

### Mobile — 수정

```
services/web/src/app/  ← 딥링크 핸들러 /register/:token 경로 추가
android/app/src/main/AndroidManifest.xml  ← App Links 경로 패턴 추가 (필요 시)
```

---

## 7. 테스트 범위

| 대상 | 테스트 |
| --- | --- |
| `InvitationService` | 생성/유효성검증/비활성화 단위 테스트 |
| `AuthService.register()` | 정상가입 / 토큰무효 / 중복username 단위 테스트 |
| `RegisterForm` | 폼 제출 / 에러 표시 컴포넌트 테스트 |

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-28 | 초안 작성 |
