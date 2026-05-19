# 신뢰기기 로그인 — 2FA 우회 동작 검증 및 수정

작성일: 2026-05-19
대상: services/api (auth + trusted-device)
유형: bug verification → (필요 시) fix

## 1. 배경

사용자 보고: "신뢰기기(trusted-device)로 등록된 클라이언트에서 다시 로그인을 시도해도 `2FA_REQUIRED` 응답을 받는 것 같다." 다만 사용자가 직접 재현해본 적은 없으며, 코드 정적 분석상 우회 로직은 살아있는 것으로 확인된다.

`services/api/src/auth/auth.service.ts:122-137`:

```ts
// 신뢰기기 쿠키 유효 시 2FA 스킵
if (trustToken && (await this.trustedDeviceService.verify(trustToken, user.id))) {
  const tokens = await this.issueTokenPair(user);
  return { response: { status: 'AUTHENTICATED', ... }, ... };
}
```

`verify`는 (a) hash 일치, (b) `userId` 일치, (c) `expiresAt > now`를 검증한다 (`trusted-device.service.ts:31-39`).

본 spec은 실제 흐름을 끝까지 재현하여 우회가 실제로 동작하는지, 동작하지 않는다면 어느 단계에서 끊기는지를 확정한다.

## 2. 코드 정적 분석 결과

| 항목 | 결론 |
|---|---|
| 우회 분기 존재 여부 | ✅ `auth.service.ts:122` |
| `trustedDeviceService.verify` 로직 | ✅ hash·userId·expiresAt 모두 검증, 정상 |
| trustToken 쿠키 설정 | ✅ `trusted-device.controller.ts:43-49` — `httpOnly·secure·sameSite=strict·path='/'` |
| login에서 cookie 읽기 | ✅ `auth.controller.ts:73` — `@Cookies('trustToken')` |
| trustToken hash 저장 | ✅ register 시 `tokenService.hashToken` — login 시 동일 hash로 조회 |

정적 분석으로는 "동작해야 마땅한" 상태다. 실제 환경에서 단절되는 단서가 있다면 다음 후보가 의심된다.

| 후보 | 검증 방법 |
|---|---|
| trustToken 쿠키가 두 번째 login 요청에 실어지지 않음 | 두 번째 login 요청의 Cookie 헤더 확인 |
| `httpOnly·secure` 옵션과 dev 환경(HTTPS 미사용) 충돌 | dev에서 secure cookie가 발송되는지 — 브라우저는 그렇다 / curl도 동일 |
| login에서 받은 trustToken cookie의 path가 register endpoint와 불일치 | path='/' 이므로 충돌 없음. 그러나 SameSite=Strict로 cross-site 요청 시 차단 |
| `findPushTokensByUserId(user.id)`가 trust 통과 후에도 호출되어 2FA가 다시 트리거됨 | 로직상 분기 이후 early return이라 발생 불가 — 그래도 확인 |

## 3. 재현 절차

owner 계정은 device가 없어 자동으로 2FA를 건너뛰므로 본 시나리오로 검증 불가하다. **2FA가 실제로 트리거되는 상태**를 먼저 만들어야 한다.

### 3.1 환경 준비

1. `make infra` + `make api`로 기동
2. owner login → access token T_owner 수령
3. owner 권한으로 device 등록: `POST /devices` (pushToken=테스트값) — 이로써 owner 계정도 2FA 트리거 대상이 됨
   - 또는 별도 USER 계정(invitation 가입)을 만들고 device 등록
4. logout

### 3.2 1차 — 2FA 트리거 확인

5. login (cookie 미동봉) → 기대 응답 `2FA_REQUIRED` (status, challengeId, options, expiresAt)
6. 챌린지에 응답: 사용자 device 측 `POST /auth/2fa/challenge/:id/respond` → 정답 selectedNumber
7. `POST /auth/2fa/challenge/:id/complete` → `AUTHENTICATED` + access token T_2fa 수령

### 3.3 2차 — 신뢰기기 등록

8. `POST /trusted-device` with Bearer T_2fa → 응답에서 Set-Cookie의 `trustToken=...` 캡처
9. logout

### 3.4 3차 — 우회 검증 (핵심)

10. login (Cookie: `trustToken=...` 동봉) → **기대 응답 `AUTHENTICATED`** (2FA 스킵)
    - 만약 `2FA_REQUIRED` 응답이면 버그 확정 — §4로 진입
    - `AUTHENTICATED` 응답이면 버그 없음 — §5 종결 처리

### 3.5 기록 양식

각 단계의 HTTP 응답·Set-Cookie·Cookie 헤더를 그대로 기록한다.

```
[Step 10 — login with trustToken cookie]
Request Cookie: trustToken=<hash>
Response status: 200
Response body: { status: "?" }
```

## 4. 버그 확정 시 진단 분기

`AUTHENTICATED`가 아니라면 다음 순서로 좁힌다.

1. **Request의 Cookie 헤더에 trustToken이 실려 있는가**
   - 없음 → 클라이언트 측 cookie 미전송 (secure/SameSite/path 검토)
   - 있음 → 다음 단계
2. **AuthController.login 핸들러의 `@Cookies('trustToken')`이 값을 받는가**
   - `cookie-parser` 미들웨어가 등록되어 있는지 확인 (`main.ts`)
   - 받지 못함 → cookie 파싱 설정 문제
   - 받음 → 다음 단계
3. **`trustedDeviceService.verify`가 어떤 분기에서 false를 반환하는가**
   - 임시 디버그 로그 삽입: hash 비교 결과, userId 비교 결과, expiresAt 비교 결과 각각 기록
   - hash 불일치 → DB row의 token_hash와 비교 hash 비교
   - userId 불일치 → 등록 시점 user와 login 시점 user가 다른 경우
   - expiresAt 만료 → 30일이 지나지 않았는지 확인

## 5. 수정 방침

- 정상 동작 확인 시: spec을 종결 처리. 추가 작업 없음.
- 버그 확정 시: 진단으로 좁힌 단일 원인에 대해 **최소 변경** 수정. 임시 디버그 로그는 모두 제거.

## 6. 회귀 방지

수정이 필요했던 경우에 한해 e2e 테스트 1건을 추가한다.

| 케이스 | 시나리오 |
|---|---|
| `login → 2FA complete → register trust → logout → login(trustToken) → AUTHENTICATED` | 본 우회 흐름의 직접 재현 케이스 |

테스트 컨벤션은 `services/api/.claude/rules/testing.md` 준수.

## 7. 스코프 외

- 누락 기능 2 (trustToken UX 고도화 — 자동 등록 UX, 명시적 등록 시점 결정 등)는 별도 spec `2026-05-19-trust-token-ux-design.md`
- 누락 기능 4 (backup code 재발급 controller)는 별도 spec
- 재구조화 5 (auth 분해)는 별도 spec — 본 spec의 위치(`auth/`, `trusted-device/`) 변화는 재구조화 spec에서 일괄 처리

## 8. 작업 산출물 체크리스트

- [ ] §3 재현 절차 실행 + 단계별 응답 기록
- [ ] 결론: "정상 동작 확인" 또는 "버그 확정 + root cause"
- [ ] 버그 확정 시: 코드 수정 — auth/trusted-device 도메인 한정
- [ ] 버그 확정 시: 임시 디버그 로그 제거 확인
- [ ] 버그 확정 시: e2e 회귀 테스트 1건 추가
- [ ] 단위 테스트 통과
- [ ] e2e 테스트 통과
