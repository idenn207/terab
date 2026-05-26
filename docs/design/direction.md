---
name: services-web-design-direction
description: services/web 디자인 방향 4 후보 평가 + 1개 채택 + 모바일-퍼스트 적용 가이드
status: in-progress
created: 2026-05-26
---

# Design Direction — services/web

> 본 문서는 Phase 1 Design Spike 의 핵심 산출물. Phase 2~10 의 시각·구조 결정이 흔들리지 않도록 1개 시각 방향 + 컴포넌트 아키텍처를 한 번에 잠근다.

---

## 1. 후보 평가표

### 1.1 평가 기준

| 기호 | 기준 | 정의 |
|---|---|---|
| (a) | 모바일 적합도 | 한 손 조작·safe-area·터치 타깃 44px+ 충족 용이성 |
| (b) | headlessui 호환도 | 기존 Catalyst 제거 + headlessui primitive 위에 wrap 가능한가 (Catalyst 호환 기준 폐기됨 — §3 참조) |
| (c) | design-quality.md "Required Qualities" 충족 | 10 개 중 4 개+ 명시 |
| (d) | 1인 운영 비용 | 토큰 1회 정의 → utility class 자동 노출. 컴포넌트 신규 작성 비용 |
| (e) | Anti-Template 통과 | design-quality.md "Banned Patterns" 8 항목 회피 가능성 |

각 항목 1~5 점. 합산 25 점 만점.

### 1.2 평가 행

| 후보 | (a) 모바일 | (b) headless 호환 | (c) Required | (d) 1인 비용 | (e) Anti-Tpl | 합계 |
|---|---|---|---|---|---|---|
| **Editorial Minimal** | 4 | 5 | 4+ 충족 → 5 | 4 | 5 | **23** |
| Bento | 3 | 4 | 4+ 충족 → 5 | 3 | 5 | 20 |
| Glassmorphism | 2 | 3 | 5 | 2 (blur perf 비용) | 5 | 17 |
| Editorial(순수) | 3 | 4 | 5 | 3 | 4 | 19 |

### 1.3 평가 메모

- **Editorial Minimal** — Inter 타이포 + oklch 단일 accent + 절제된 whitespace. 파일 매니저의 "정보가 주인공" 특성과 정합. headlessui primitive 그대로 wrap 가능, 추가 effect 없음.
- **Bento** — 정보 밀도는 NAS 도메인과 자연스러우나, 모바일에서 카드가 작아져 한 손 조작 시 터치 정확도 하락. Phase 7+ 의 폴더 트리에는 부적합.
- **Glassmorphism** — Capacitor Android WebView 에서 `backdrop-filter: blur()` perf 비용이 큼. 시각적으로 매력적이나 운영 환경 제약.
- **Editorial(순수)** — 타이포 헤비. 파일 목록처럼 데이터 밀도가 높은 화면에서 행 높이가 비효율.

---

## 2. 채택 — Editorial Minimal

### Decision

**채택**: Editorial Minimal — Inter 단일 폰트 + oklch 단일 accent (파랑 계열) + 절제된 whitespace + 의미 단위 색 사용.

### Rationale (1 단락)

본 프로젝트는 1인 셀프호스팅 NAS 의 파일 매니저로, **데이터(파일 목록·미리보기)가 주인공**이고 UI 가 배경에 머물러야 한다. Editorial Minimal 은 타이포·여백·단일 accent 만으로 위계를 만들어 정보의 절대량을 가리지 않으면서도, oklch 팔레트와 fluid 타이포(clamp)로 default 템플릿처럼 보이는 위험(design-quality.md "Safe gray-on-white" 패턴)을 회피한다. Catalyst 제거 후 headlessui primitive 위에 직접 wrap 하는 컴포넌트 전략과도 가장 정합 — 추가 effect (blur, gradient, layered shadow) 없이도 의도가 보이는 시각 톤이기 때문이다. 본인 취향이 아니라 평가표 점수(합계 23/25) 로 결정.

### Rejected 후보 (1 줄씩)

- **Bento** (20) — 모바일 카드 분할 시 터치 정확도·트리뷰 부적합.
- **Editorial 순수** (19) — 타이포 헤비라 파일 목록 행 효율 손실.
- **Glassmorphism** (17) — Capacitor Android `backdrop-filter` perf 비용.

### Required Qualities 충족 (design-quality.md)

채택안이 명시적으로 충족하는 5 항목 (4 개+ 요건):

1. **Scale contrast** — clamp() 기반 fluid 타이포 (`--text-xs` ~ `--text-3xl` 7 단계, Phase 2 부터 화면별 적용)
2. **Intentional rhythm** — `--spacing-section` / `--spacing-gutter` 가 fluid 로 정의돼 화면 너비에 따라 호흡 자동 조정
3. **Color used semantically** — accent / success / warning / danger 4 색만 의미 단위로 사용. 장식 색 없음
4. **Designed interaction states** — hover / focus / active 별 토큰 분리 (`--color-accent-hover`)
5. **Motion clarifies flow** — `--motion-ease-out` 220ms 가 모든 transition 기본값, spring 은 강조 액션 전용

### 모바일-퍼스트 적용 가이드

| 영역 | 모바일 (≤ 768) | 데스크톱 (≥ 1024) |
|---|---|---|
| Sidebar | drawer (headlessui Dialog 기반) | collapsed icon-only 또는 full (현 Drive.tsx 동작 유지) |
| Typography | `--text-base` = 1rem 시작, `--text-xl`~`--text-3xl` 만 화면별 scale | 동일 토큰, viewport vw 기여분으로 자동 확대 |
| Interaction 우선순위 | UploadButton + 파일 카드 = 단일 액션 (탭) | 멀티 선택 + hover preview + 키보드 단축키 |
| 다크모드 | OS 자동 추종 (`prefers-color-scheme`, `.dark` class) | 동일 |
| safe-area | `--spacing-safe-top/bottom` 모든 fixed 요소에 적용 | 영향 없음 |
| 터치 타깃 | 최소 44×44px, 카드 간 간격 `--spacing-gutter` 보장 | 32×32px 도 허용 |

### Phase 별 적용 가이드 (1줄씩)

- **Phase 2 (Domain Skeleton)**: Drive.tsx 분해 시 `--color-surface` / `--color-text` 토큰으로 zinc-* 직접 사용 제거 시작
- **Phase 3 (Upload)**: UploadButton 은 `--color-accent` 단일 accent 의 단독 사용처
- **Phase 4 (List/Preview/Download)**: 파일 카드는 `--color-surface-elevated` + `--radius-lg` + hover 시 `--motion-duration-fast`
- **Phase 5 (Invitation)**: 초대 코드 표시 = `--text-2xl` mono + `--color-accent-soft` 배경
- **Phase 6 (E2E)**: UseCase E2E 가 토큰 변경에 영향 받지 않도록 selector 는 `data-testid` 우선
- **Phase 7~8 (Folder/Trash)**: 트리뷰 들여쓰기 = `--spacing-gutter` 배수
- **Phase 9 (Search)**: 검색 입력 = `--color-border` → focus 시 `--color-accent`
- **Phase 10 (Polish)**: 320/768/1024/1440 4 breakpoint 모두 fluid 토큰만으로 흡수

---

## 3. 컴포넌트 아키텍처 결정 (사용자 지시 반영)

**결정**: Catalyst UI 완전 제거 + headlessui primitive 위에 자체 컴포넌트 작성.

- **Why**: Catalyst 는 의견 있는 wrapper (zinc 강제, headlessui primitive 노출 제한). 자체 시각 방향 (Editorial Minimal) 이 zinc 종속을 깨므로 직접 wrap 이 자연스러움.
- **How**: 자세한 컴포넌트 카탈로그 + headlessui 매핑은 [component-catalog.md](component-catalog.md).
- **When**: 실제 제거 작업은 Phase 2 (Domain Skeleton) 의 sub-task 로 진행. 이 spike 는 결정만 박제.

---

## 4. Decisions Log

| 날짜 | Decision | Choice | Alternatives | Rationale |
|---|---|---|---|---|
| 2026-05-26 | 디자인 방향 채택 | Editorial Minimal | Bento / Glassmorphism / Editorial 순수 | 평가표 합계 23/25, NAS 정보 밀도 + Capacitor perf + headless 호환 정합 |
| 2026-05-26 | 컴포넌트 아키텍처 | Catalyst 제거 + headlessui 직접 wrap | Catalyst 유지 / 다른 UI 라이브러리 도입 | 시각 방향(Editorial Minimal)이 zinc 팔레트 종속과 충돌. 사용자 명시 지시 |

---

## Notes

- 이 문서는 디자인 방향 변경 시 새 문서를 만들지 않고 §1 평가표 + §2 채택 + §4 Decisions Log 를 직접 갱신한다.
- 평가 점수는 후일 재검토의 baseline. 점수만 갱신해도 의사결정 추적 가능.
- 본 spike 종료 시 frontmatter `status: in-progress` → `done` 으로 갱신.
