---
name: services-web-usecases
description: services/web UseCase 시나리오 6개 (Phase 6 E2E 자동화 입력)
status: pending
created: 2026-05-26
---

# UseCases — services/web

> Phase 6 (MVP Verification) 의 E2E 자동화 입력. 각 UseCase 는 Playwright selector 까지 추정 가능한 step 단위 작성.
> UC-01 은 MVP one-liner 와 정확히 매핑.

---

## UC-01 — MVP one-liner (모바일 → PC 사진 1장)

| 필드 | 값 |
|---|---|
| id | UC-01 |
| title | 모바일에서 사진 1장 업로드 → PC 에서 5초 이내 확인·다운로드 |
| actor | 모바일 본인 + 데스크톱 본인 (동일 계정) |
| precondition | 로그인 완료, 둘 다 같은 계정 인증 세션 |
| related PRD phase | Phase 3 + Phase 4 + Phase 6 |
| MoSCoW | Must (3 개 모두) |

**Steps (Mobile)**
1. `/drive` 진입
2. FAB `[+]` 탭 (`data-testid=upload-fab`)
3. bottom-sheet 에서 "🖼 갤러리" 탭 (`data-testid=upload-source-gallery`)
4. 파일 선택 (테스트 fixture: `tests/fixtures/photo-001.jpg`, ≤ 5MB)
5. 진행률 0→100% 관찰 (`data-testid=upload-progress`)
6. "✓ 업로드 완료" toast 확인 (`data-testid=toast-upload-success`)
7. **시작 timestamp 기록 (T0)**

**Steps (Desktop, 동일 계정)**
8. `/drive` 진입
9. **timestamp 기록 (T1)**, 목록 최상단 행 확인 (`data-testid=file-row-0`)
10. T1 - T0 ≤ 5000ms 검증
11. 행 클릭 → preview panel 열림 (`data-testid=preview-panel`)
12. preview 이미지 src 가 fixture 파일과 일치
13. `[⬇ 다운로드]` 클릭 (`data-testid=preview-download`)
14. 다운로드 파일 SHA-256 가 fixture 와 일치

**Success Criteria**
- 모바일 업로드 → PC 표시 ≤ 5000ms
- preview 이미지 정상 렌더링
- 다운로드 파일 무결성 (해시 일치)

---

## UC-02 — 초대 코드 발급 → 다른 디바이스 가입

| 필드 | 값 |
|---|---|
| id | UC-02 |
| title | 본인 다른 디바이스용 초대 코드 발급 → 그 코드로 RegisterForm 가입 |
| actor | 데스크톱 본인 (admin) + 모바일 본인 (게스트 디바이스) |
| precondition | 본인 admin 계정 로그인 |
| related PRD phase | Phase 5 + Phase 6 |
| MoSCoW | Must |

**Steps**
1. 데스크톱: 사용자 메뉴 `[👤▾]` → "초대 발급" (`data-testid=menu-invite`)
2. 초대 모달에서 만료(예: 1h) 선택 → `[발급]` (`data-testid=invite-issue-btn`)
3. 발급된 코드 표시 + `[복사]` 클릭 (`data-testid=invite-code`, `data-testid=invite-copy`)
4. 모바일 신규 세션: `/register/<code>` 진입
5. 이메일·비밀번호 입력 → `[가입]`
6. 가입 성공 → `/drive` 리다이렉트

**Success Criteria**
- 코드 생성 + 복사 동작
- 동일 코드로 가입 성공
- 만료 후 동일 코드 재사용 실패 (`410 Gone` 또는 동등 에러)

---

## UC-03 — 폴더 생성 → 파일 이동

| 필드 | 값 |
|---|---|
| id | UC-03 |
| title | 폴더 만들기 → 파일 1개를 그 폴더로 이동 |
| actor | 데스크톱 본인 |
| precondition | drive 에 파일 1개 이상 존재 |
| related PRD phase | Phase 7 |
| MoSCoW | Should |

**Steps**
1. toolbar `[+ 폴더]` 클릭 (`data-testid=folder-create-btn`)
2. 폴더명 "사진-2026" 입력 → 엔터
3. 새 행 표시 확인 (`data-testid=folder-row-사진-2026`)
4. 기존 파일 행 우측 `[⋯]` → "이동" (`data-testid=row-actions-move`)
5. 이동 dialog 에서 "사진-2026" 선택 → `[이동]`
6. 원래 위치에서 사라지고 폴더 진입 시 표시됨

**Success Criteria**: 폴더 생성·이동 모두 desktop·mobile 동작.

---

## UC-04 — 휴지통 복원

| 필드 | 값 |
|---|---|
| id | UC-04 |
| title | 파일 삭제 → 휴지통에서 복원 |
| actor | 데스크톱 본인 |
| precondition | drive 에 파일 1개 이상 |
| related PRD phase | Phase 8 |
| MoSCoW | Should |

**Steps**
1. 파일 행 `[⋯]` → "삭제"
2. 확인 dialog → `[삭제]`
3. drive 목록에서 사라짐
4. sidebar "🗑 휴지통" 클릭
5. 휴지통 페이지에 해당 파일 표시 (`data-testid=trash-row-0`)
6. `[복원]` 클릭 → drive 로 돌아옴

**Success Criteria**: 휴지통 → 복원 / 영구삭제 양쪽 동작.

---

## UC-05 — 검색 (선택, API 범위 확인 후)

| 필드 | 값 |
|---|---|
| id | UC-05 |
| title | 파일명 부분일치 검색으로 결과 확인 |
| actor | 데스크톱 본인 |
| precondition | 동일 prefix 파일 ≥ 3개 (예: `photo-001`, `photo-002`, `photo-003`) |
| related PRD phase | Phase 9 |
| MoSCoW | Should (API 범위 부족 시 Could 강등) |

**Steps**
1. navbar 검색 입력에 "photo" 타이핑 (`data-testid=navbar-search`)
2. 200ms 디바운스 후 결과 표시
3. 결과 행 ≥ 3 개 확인
4. 모든 결과 파일명에 "photo" 포함

**Success Criteria**: 디바운스 동작, 부분일치 결과.

---

## UC-06 — 모바일 카메라 직접 업로드 (Capacitor 검증)

| 필드 | 값 |
|---|---|
| id | UC-06 |
| title | Capacitor Android 앱에서 카메라로 즉시 촬영 → 업로드 |
| actor | 모바일 본인 (Capacitor Android) |
| precondition | Capacitor Android 빌드, 카메라 권한 grant |
| related PRD phase | Phase 3 + Phase 6 |
| MoSCoW | Must (Capacitor 호환성 회귀) |

**Steps**
1. FAB `[+]` → "📷 카메라" 탭
2. (네이티브 카메라 프롬프트 — Playwright 자동화 불가, **수동 검증** 또는 mock)
3. 촬영 → 업로드 진행률
4. drive 목록에 표시

**Automation hint**: 자동화는 갤러리 input mock 으로 대체. 실기기 수동 검증 별도.

---

## PRD MoSCoW 매핑 표

| UseCase | Must (invitation) | Must (upload) | Must (list/preview/dl) | Should (folder) | Should (trash) | Should (search) |
|---|---|---|---|---|---|---|
| UC-01 | | ✓ | ✓ | | | |
| UC-02 | ✓ | | | | | |
| UC-03 | | | | ✓ | | |
| UC-04 | | | | | ✓ | |
| UC-05 | | | | | | ✓ |
| UC-06 | | ✓ | | | | |

Must 3개 모두 커버: UC-01 + UC-02 + UC-06.
Should 3개 모두 커버: UC-03 + UC-04 + UC-05.

---

## Phase 6 자동화 우선순위

1. **MVP 자동화 (Phase 6 시작)**: UC-01, UC-02
2. **회귀 확장 (Phase 6 중반)**: UC-03, UC-04
3. **확장 (Phase 9 이후)**: UC-05
4. **수동 회귀 (각 phase 빌드 시)**: UC-06 (실기기)

---

## Notes

- 모든 `data-testid` 는 컴포넌트 작성 시 함께 부여한다 (Phase 2~5 작업 표준).
- UC-05 는 API 검색 범위 확인 후 `MoSCoW` 갱신.
- 본 문서는 Phase 6 종료 시 frontmatter `status: pending` → `done` 갱신.
