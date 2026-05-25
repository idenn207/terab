# trustToken UX 고도화 — 신뢰기기 등록 트리거 정책

작성일: 2026-05-19
대상: services/api (auth + trusted-device) + services/web
유형: feature design (정책 결정 + 구현)

## 1. 배경

`/trusted-device` POST 엔드포인트는 존재하지만, **언제 호출할지에 대한 정책이 없다.** 현재 흐름은 다음과 같다.

- 사용자가 2FA를 통과해 `AUTHENTICATED` 상태가 된다
- 클라이언트가 별도로 `POST /trusted-device`를 호출해야 trustToken 쿠키가 발급된다
- 호출 시점·트리거(자동/수동), 사용자 동의 표현, 등록된 기기 목록 노출 등은 정해진 바 없음

결과적으로 trustToken 기능이 "API는 살아있되 클라이언트가 호출할 일이 없는" 유휴 상태에 가깝다.

본 spec은 trustToken 발급 UX 정책을 결정하고 그에 필요한 서버·웹 변경을 정의한다.

## 2. 결정해야 할 정책

### 2.1 트리거 시점 — 3가지 옵션

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| A. 자동 등록 (2FA 완료 직후) | `POST /auth/2fa/challenge/:id/complete` 응답에 trustToken 쿠키를 자동 동봉 | 사용자가 별도 액션 불필요, UX 매끄러움 | 사용자 의도와 무관하게 모든 기기가 trust됨 — 공용 PC에서 위험 |
| B. 명시적 선택 (2FA 완료 화면에서 "이 기기 기억" 체크박스) | 2FA 통과 화면에서 "이 기기를 30일간 신뢰" 체크 → 체크 시에만 `POST /trusted-device` 호출 | 사용자 의도 반영, 공용 PC 보호 | 클릭 1회 추가, 사용자가 매번 선택해야 함 |
| C. 사후 등록 (설정 페이지) | 로그인 후 별도 "보안 설정"에서 현재 기기를 신뢰 등록 | 명시적·관리 페이지와 자연스럽게 통합 | 사용자가 거의 안 누름 — 사실상 dormant 상태 유지 |

**권장: B (명시적 선택)**. 보안 제품의 표준 패턴이며, A는 "사용자가 모르는 사이 신뢰됨"이라는 정책적 부담이 크다.

### 2.2 기간

현재 `TRUST_DURATION_MS = 30일`. 산업 표준(Google·Microsoft 30일)과 일치. **유지** 권장.

### 2.3 등록된 기기 관리

`GET /trusted-device` + `DELETE /trusted-device/:id`는 이미 존재. 웹에서 "보안 설정 → 신뢰기기 목록"으로 노출. 본 spec 범위 안. UI는 frontend-design에서 별도 다룬다.

### 2.4 동시 신뢰기기 수 제한

현재 무제한. 30일 자동 만료가 있긴 하나, 한 사용자가 무한정 trust 기기를 누적할 수 있다.

**권장: 사용자당 최대 10대 — 초과 시 가장 오래된 trust 자동 폐기.** 모바일·노트북·데스크탑·태블릿을 고려하면 10대는 충분히 여유롭고, 동시에 lost device 누적도 방지된다.

## 3. 결정 사항 (2026-05-19 확정)

| 항목 | 결정 |
|---|---|
| 트리거 시점 | **B. 명시적 선택 (체크박스)** — 2FA 완료 화면에서 "이 기기를 30일간 신뢰" 체크 시에만 `POST /trusted-device` |
| 기간 | **30일 유지** (sliding window — §9.3 참조) |
| 동시 신뢰기기 수 제한 | **10대**, 초과 시 가장 오래된 trust 자동 폐기 |
| sliding expiry | **도입** — verify 성공 시 expiresAt 갱신 |
| sliding hard cap | **90일** (`createdAt + 90일` 절대 상한) |
| fallback 2FA strategy (TOTP/Passkey 등) | **별도 spec으로 분리** (`auth-2fa-fallback-strategies-design`) — 본 spec scope 외 |
| 비밀번호 변경 시 모든 trust 폐기 | 표준 보안 관행이나, 비밀번호 변경 endpoint 자체가 미구현 — 별도 spec |
| 신뢰기기 목록 UI 디자인 | 별도 frontend-design 단계로 deferred |

## 4. 변경 범위 (B 옵션 채택 가정)

### 4.1 API

| 변경 | 내용 |
|---|---|
| `POST /trusted-device` | 그대로. 단 동시 trust 수 제한 추가 (초과 시 가장 오래된 trust delete) |
| `auth.service.changePassword` (장래) | 비밀번호 변경 시 `trustedDeviceService.revokeAllByUserId(userId)` 호출 — 본 spec 범위 외, 누락 4 backup-code regenerate spec과 연관 (비밀번호 재확인 패턴) |
| 신규 endpoint 없음 | UX는 클라이언트가 기존 endpoint를 호출하는 시점만 바뀜 |

### 4.2 Service

`TrustedDeviceService`에 다음을 추가:

```ts
private readonly MAX_TRUST_PER_USER = 10;
private readonly TRUST_ABSOLUTE_MAX_MS = 90 * 24 * 60 * 60 * 1000; // hard cap

@LogReplay()
async register(userId, userAgent): Promise<string> {
  const rawToken = ...;
  await this.runInTx(async () => {
    await this.trimExcessDevices(userId);  // 새로 등록 전 oldest trim
    await this.trustedDeviceRepository.insert(...);
  });
  return rawToken;
}

private async trimExcessDevices(userId: string): Promise<void> {
  const now = new Date();
  const active = await this.repo.countActiveByUserId(userId, now);
  const overflow = active - (this.MAX_TRUST_PER_USER - 1); // 신규 1대 분 자리 확보
  if (overflow > 0) await this.repo.deleteOldestByUserId(userId, overflow);
}
```

### 4.3 Repository

- `TrustedDeviceRepository.countActiveByUserId(userId, now): Promise<number>` — 만료되지 않은 trust 개수
- `TrustedDeviceRepository.deleteOldestByUserId(userId, count): Promise<void>` — `createdAt` asc로 N개 삭제
- `TrustedDeviceRepository.refreshExpiresAt(id, expiresAt): Promise<void>` — sliding 갱신용

### 4.4 verify sliding + hard cap

`TrustedDeviceService.verify`가 검증 성공 시 다음을 수행한다.

```
candidateExpiresAt = now + TRUST_DURATION_MS
hardCapAt          = createdAt + TRUST_ABSOLUTE_MAX_MS
newExpiresAt       = min(candidateExpiresAt, hardCapAt)
if newExpiresAt > 현재 expiresAt: refreshExpiresAt(id, newExpiresAt)
```

- hard cap에 도달한 trust는 더 이상 연장되지 않고, 만료 시 자연히 폐기되어 사용자는 다시 등록 절차를 거친다 (rolling exposure 차단)
- `verify`는 read-only 의미였으나 본 변경으로 write side-effect가 생긴다 → 호출처(`twofa.service.ts`의 verify caller)에서 tx에 포함되지 않더라도 update 1건이라 별도 tx 래퍼 불필요

### 4.5 Web

- 2FA 완료 화면 (`features/login-by-2fa/ui/`)에 "이 기기를 30일간 신뢰" 체크박스 추가
- 체크 + 2FA complete 성공 시 `POST /trusted-device` 호출
- "보안 설정 → 신뢰기기 목록" 페이지는 별도 frontend-design 단계로 deferred (본 spec은 trigger UX만 정의)

## 5. 테스트

| 레벨 | 케이스 |
|---|---|
| 단위 (TrustedDeviceService) | `register`가 11번째 호출 시 가장 오래된 기기를 삭제하는지 |
| 단위 (TrustedDeviceRepository) | `deleteOldestByUserId`가 expiresAt asc로 정확히 N개를 삭제하는지 |
| e2e | 11번째 trust 등록 시 1번째가 폐기되어 list 응답 길이가 10인지 |

## 6. 스코프 외

- 비밀번호 변경 시 trust 일괄 폐기 — 비밀번호 변경 endpoint 자체가 미구현. 누락 4 spec과 함께 묶일 가능성 있음
- 신뢰기기 목록 UI 디자인 (등록 시각·기기명·해제 버튼 등)
- bug 3(우회 동작 검증)이 우선 통과되어야 본 spec 의미 있음 — 종속 관계

## 7. 종속

본 spec은 `finish-specs/2026-05-19-trusted-device-2fa-bypass-verification-design.md`(종결됨, 서버 로직 정상 확인)에서 식별된 후속 결함 §9·§10과 연결된다. 본 spec(trigger UX) implementation 전에 §9의 결정 사항을 함께 다뤄야 한다.

## 9. 후속 결함 — trust 만료 데드락 & 2FA fallback 부재

bug 3 spec 종결 시점에 식별된 정책 결함. **결정 사항**: §9.3 sliding expiry + 90일 cap은 본 spec에서 함께 구현하고, §9.2 fallback strategy(TOTP/Passkey)는 별도 spec으로 분리한다.

### 9.1 trust 만료 데드락

- `TRUST_DURATION_MS = 30일`이 지나면 다시 2FA 요구
- 현재 2FA는 push 방식뿐 — "이미 로그인된 다른 device가 응답"하는 구조
- 마지막 신뢰기기의 trust가 만료된 사용자는 **응답할 device가 없어 영구 락아웃**
- 백업 코드 로그인(`POST /auth/login/backup`)은 존재하지만 사용자가 코드 보관 안 했으면 마찬가지 락아웃

### 9.2 fallback 2FA strategy 부재

push 외에 다음 인증 strategy 부재 — 사용자 결정 필요:

| Strategy | 설명 | 우선순위 |
|---|---|---|
| TOTP (RFC 6238) | Google Authenticator·1Password 같은 OTP 앱 기반 6자리 코드 | 표준·검증된 보안. 1순위 권장 |
| Passkey / WebAuthn (FIDO2) | platform authenticator(지문·Face ID·Windows Hello)·hardware key | UX 최상·강한 보안. 2순위 |
| Backup code (이미 부분 구현) | 일회용 8자리 8개. login만 있고 재발급 spec은 별도(누락 4) | "최후의 수단" — fallback의 fallback |
| Email magic link | 이메일 인증 링크 | 별도 SMTP 인프라 필요. 본 NAS 구성에는 부적합 가능성 |

추상화 방향: `TwoFaStrategy` 인터페이스 + 각 구현체. 사용자는 본인 계정에 등록된 strategy 목록 중 선택해 2FA challenge 응답.

### 9.3 sliding expiry

- 현재 trustToken은 등록 시점 + 30일 고정. 매일 활성 사용자라도 30일 후 강제 재인증
- **sliding window**: 매 verify 성공 시 `expiresAt`을 `now() + TRUST_DURATION_MS`로 갱신 — 30일간 무사용 시에만 만료
- 변경 범위: `TrustedDeviceService.verify` 안에서 verify 성공 직후 `repository.refreshExpiresAt(id, newExpiresAt)` 호출. 1줄.
- 트레이드오프: rolling exposure(영영 만료 안 됨) → 절대 최대 기간 cap이 필요할 수도 있음(예: `absoluteExpiresAt = createdAt + 90일`로 hard cap)

### 9.4 결정 사항 (2026-05-19 확정)

| 항목 | 결정 |
|---|---|
| sliding expiry 도입 | **Yes** — `verify` 성공 시 `expiresAt = now + TRUST_DURATION_MS`로 갱신 |
| sliding hard cap | **90일** — `createdAt + 90일`을 초과해 갱신하지 않음 |
| fallback strategy (TOTP/Passkey) | **본 spec 외 — 별도 spec으로 분리** (`auth-2fa-fallback-strategies-design`) |

## 8. 작업 산출물 체크리스트

- [x] §3 결정 항목에 대한 사용자 확인 (2026-05-19 확정)
- [x] `TrustedDeviceRepository`에 `countActiveByUserId`, `deleteOldestByUserId`, `refreshExpiresAt` 추가
- [x] `TrustedDeviceService.register`에 trim 로직 + 상수(`MAX_TRUST_PER_USER=10`, `TRUST_ABSOLUTE_MAX_MS=90일`) 추가
- [x] `TrustedDeviceService.verify`에 sliding expiry + hard cap 추가
- [x] web 2FA 완료 화면 — `TwoFactorWaiting` + `useTwoFactorPolling.onAuthenticated`로 이미 wired (코드 변경 불필요)
- [x] 단위 테스트 추가 (Repository 7 + Service register 4 + Service sliding 4 = 15 신규, 전체 324/324 GREEN)
- [x] e2e 테스트 추가 (`test/trusted-device.e2e-spec.ts`, 5/5 GREEN — trim/sliding/cap 4 시나리오)
- [x] 기존 테스트 통과
- [x] fallback strategy(`auth-2fa-fallback-strategies-design`) 별도 spec 작성 (commits `1a8f760`, `c2b5460`)

## 9. Resolution (2026-05-19 종결)

본 spec의 모든 작업 산출물이 처리됐다. 후속 결함(§9.2 fallback strategy)은 별도 spec으로 분리해 트래킹 중이며 본 spec 범위에서 분리된다.

### 9.1 구현 요약

| 영역 | 변경 |
|---|---|
| Schema | 변경 없음 (`trusted_devices` 기존 컬럼만 활용 — `createdAt` 기반 cap, `expiresAt` 기반 sliding) |
| Repository | `countActiveByUserId`, `deleteOldestByUserId`(select→`inArray`로 PG 제약 우회), `refreshExpiresAt` 추가 |
| Service | `MAX_TRUST_PER_USER = 10`, `TRUST_ABSOLUTE_MAX_MS = 90일` 상수 도입. `register`를 `runInTx`로 감싸고 trim 후 insert. `verify` 성공 직후 `slideExpiresAt`으로 `min(now+30일, createdAt+90일)` 갱신, 단 새 값이 현재 값보다 클 때만 update |
| Controller | 변경 없음 (`POST /trusted-device` endpoint 기존 유지) |
| Web | 변경 없음 (`TwoFactorWaiting` + `useTwoFactorPolling.onAuthenticated` 콜백이 이미 wired — server 정책 부재로 dormant였던 client가 자동으로 활성화) |

### 9.2 테스트 결과

- 단위 신규 15: Repository 7 + Service register 4 + Service sliding 4
- e2e 신규 5: trim 2 + sliding 1 + cap 2 (실제 DB row의 `createdAt`을 위조해 시간 의존 분기 검증)
- 전체 단위 324/324 GREEN, e2e 5/5 GREEN

### 9.3 커밋 이력

- `fd25f9e` feat(api): 신뢰기기 trust UX 정책 — trim·sliding·hard cap 추가
- `1a8f760` docs(superpowers): 2FA fallback strategy(TOTP/Passkey) 별도 spec 작성
- `c2b5460` docs(superpowers): auth-2fa-fallback §3 결정 항목 사용자 확인 반영

### 9.4 분리된 후속 spec

- [`2026-05-19-auth-2fa-fallback-strategies-design.md`](../specs/2026-05-19-auth-2fa-fallback-strategies-design.md) — §9.2 fallback strategy(TOTP/Passkey) 인터페이스·구현 단계 분할. §3 결정 박제 완료, Phase 0 implementation 진입 대기.

### 9.5 잔여 작업 (본 spec 외)

- 신뢰기기 목록 페이지(`TrustedDeviceSection` placeholder → 등록 시각·UA·해제 버튼) — frontend-design 단계
- 비밀번호 변경 시 모든 trust 폐기 — 비밀번호 변경 endpoint 자체가 미구현, 별도 spec 필요
