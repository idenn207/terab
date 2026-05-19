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

## 3. 결정 필요 항목 (사용자 확인)

본 spec을 implementation으로 전환하기 전 다음 결정이 필요하다.

| 항목 | 권장 |
|---|---|
| 트리거 시점 | B. 명시적 선택 (체크박스) |
| 기간 | 30일 유지 |
| 동시 신뢰기기 수 제한 | 10대, 초과 시 가장 오래된 trust 자동 폐기 |
| 비밀번호 변경 시 모든 trust 폐기 | Yes — 표준 보안 관행 |
| 본 spec 종료 후 잔여 작업 (UI 디자인) | 별도 frontend-design 단계로 deferred |

## 4. 변경 범위 (B 옵션 채택 가정)

### 4.1 API

| 변경 | 내용 |
|---|---|
| `POST /trusted-device` | 그대로. 단 동시 trust 수 제한 추가 (초과 시 가장 오래된 trust delete) |
| `auth.service.changePassword` (장래) | 비밀번호 변경 시 `trustedDeviceService.revokeAllByUserId(userId)` 호출 — 본 spec 범위 외, 누락 4 backup-code regenerate spec과 연관 (비밀번호 재확인 패턴) |
| 신규 endpoint 없음 | UX는 클라이언트가 기존 endpoint를 호출하는 시점만 바뀜 |

### 4.2 Service

`TrustedDeviceService`에 동시 신뢰기기 수 제한 로직 추가:

```ts
async register(userId, userAgent): Promise<string> {
  await this.runInTx(async () => {
    await this.trimExcessDevices(userId); // 새로 등록 전 가장 오래된 trust 폐기
    // 기존 insert 로직
  });
  return rawToken;
}

private async trimExcessDevices(userId: string): Promise<void> {
  const MAX_TRUST_PER_USER = 10;
  // 현재 활성 trust 개수 조회 → MAX 초과 시 expiresAt asc로 (count - MAX + 1)개 삭제
}
```

### 4.3 Repository

- `TrustedDeviceRepository.countByUserId(userId): Promise<number>`
- `TrustedDeviceRepository.deleteOldestByUserId(userId, count): Promise<void>`

### 4.4 Web

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

본 spec은 `2026-05-19-trusted-device-2fa-bypass-verification-design.md`이 "정상 동작 확인 또는 fix 완료" 상태가 된 뒤에 진행한다. 우회 자체가 깨져 있으면 UX 고도화 의미가 없다.

## 8. 작업 산출물 체크리스트

- [ ] §3 결정 항목에 대한 사용자 확인 — implementation 전 필수
- [ ] `TrustedDeviceRepository`에 `countByUserId`, `deleteOldestByUserId` 추가
- [ ] `TrustedDeviceService.register`에 trim 로직 추가
- [ ] web 2FA 완료 화면에 체크박스 추가 및 mutation 연결
- [ ] 단위 테스트 + e2e 테스트 추가
- [ ] 기존 테스트 통과
