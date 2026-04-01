# NAS Drive 릴리스 계획

---

## 버전 전략

**Semantic Versioning** (Major.Minor.Patch) 기반:

| 구분 | 의미 | 예시 |
|---|---|---|
| Major (X.0.0) | 호환성 파괴 변경 | 인증 체계 변경, DB 스키마 대규모 마이그레이션 |
| Minor (0.X.0) | 기능 추가 (하위 호환) | 새 화면, 새 API 엔드포인트 |
| Patch (0.0.X) | 버그 수정 | 핫픽스, 사소한 UI 수정 |

**배포 방식**: GitHub Actions → ghcr.io → Watchtower 자동 배포
**브랜치**: feature/* → dev → PR → master (Squash merge)

---

## 마일스톤 요약

| 버전 | 목표 | 요구사항 | 핵심 키워드 |
|---|---|---|---|
| **v0.1.0** | Core Platform | 28개 (Must) | 인증, Push 2FA, 모바일, 파일 CRUD, 공유 링크, 관리자 기본 |
| **v0.1.1** | UX Enhancement | 8개 (Should) | 즐겨찾기, 최근, 정렬, 프로필, 쿼터, 휴지통 |
| **v0.1.2** | Access Control | 12개 (Should) | 권한 공유, 커스텀 역할, 감사 로그, 시스템 모니터링 |
| **v0.2.0** | Automation | 4개 (Could) | 자동 정리, Email, 쿼터 알림, 통계 |

> 상세 범위 및 화면 목록은 [milestones.md](milestones.md) 참조

---

## v0.1.0 개발 Phase

솔로 개발자의 의존성 순서를 고려한 6단계 순차 Phase.
각 Phase는 이전 Phase의 산출물에 의존한다.

### Phase 1: Foundation (인프라 + 인증 기반)

> **목적**: 모든 기능의 토대가 되는 인증/권한 시스템 구축

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-001 | 프로젝트 구조 설정 (admin, mobile, notification 디렉토리) | 인프라 | S | 기존 api/web/nginx에 추가 |
| DEV-002 | DB 스키마 설계 + Flyway 마이그레이션 | AUTH-01, AUTH-05, AUTH-06 | L | users, roles, permissions 등 RBAC 테이블 |
| DEV-003 | 자체 로그인 API (ID+PW, JWT Access+Refresh) | AUTH-01 | L | bcrypt, Spring Security |
| DEV-004 | RBAC 권한 체계 + 기본 역할 시딩 | AUTH-05, AUTH-06 | L | OWNER/ADMIN/USER, 환경변수 초기 관리자 |
| DEV-005 | Drive Web 초기 설정 (React 19 + Vite + Router) | AUTH-01 | M | Layout-A, Layout-C 구현 |
| DEV-006 | 로그인 화면 (D-01) | AUTH-01 | M | Web + 모바일 공용 |

**산출물**: 로그인 가능한 기본 인증 시스템, RBAC 테이블, 기본 역할 3종

---

### Phase 2: Notification + Mobile (Push 2FA 전제 조건)

> **목적**: Push 2FA에 필요한 알림 마이크로서비스와 모바일 앱 기반 구축

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-007 | Notification MS 구축 (MQ 연동, 이벤트 소비) | NOTIF-01 | XL | Spring Boot + RabbitMQ |
| DEV-008 | FCM/APNs Push 채널 연동 | NOTIF-02 | L | Firebase 프로젝트, APNs 인증서 |
| DEV-009 | Capacitor 하이브리드 앱 셸 | MOBILE-01 | XL | iOS/Android, 네이티브 브릿지 |
| DEV-010 | Push 알림 수신 (모바일) | MOBILE-02 | L | Capacitor Push Notifications |
| DEV-011 | 딥링크 설정 | MOBILE-03 | M | Universal Links / App Links |

**산출물**: MQ 기반 알림 서비스, Push 수신 가능한 모바일 앱 셸, 딥링크

---

### Phase 3: 2FA + Onboarding (인증 완성)

> **목적**: Push 2FA 전체 플로우 + 회원가입 + 보안 기능 완성

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-012 | Push 2FA 백엔드 (챌린지, MQ, WebSocket/SSE) | AUTH-07 | XL | 60초 타임아웃, 숫자 매칭 |
| DEV-013 | Push 2FA PC 프론트엔드 (D-01a, D-01b) | AUTH-07, AUTH-09 | L | WebSocket 연동 |
| DEV-014 | Push 2FA 모바일 (D-01c 승인 모달) | AUTH-07 | L | 숫자 입력 + 승인/거부 |
| DEV-015 | 신뢰기기 (30일 2FA 스킵) | AUTH-08 | M | DB + 쿠키/토큰 |
| DEV-016 | 백업 코드 (8개 발급, D-02a) | AUTH-09 | M | bcrypt 해싱, 1회용 |
| DEV-017 | 초대 기반 가입 (D-02) | AUTH-02 | L | 딥링크 진입, 앱 가입 |
| DEV-018 | 디바이스 관리 (D-10a) | AUTH-11 | M | 주 디바이스, 추가/제거 |

**산출물**: 완성된 인증 체계 (로그인 + Push 2FA + 가입 + 신뢰기기 + 백업 코드 + 디바이스 관리)

---

### Phase 4: File Management (핵심 파일 기능)

> **목적**: 드라이브 핵심인 파일/폴더 CRUD + 검색

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-019 | 파일 업로드 API + MinIO 연동 | FILE-01 | L | Presigned URL 또는 Proxy |
| DEV-020 | 파일 다운로드 API (단일 + ZIP) | FILE-02 | M | ZIP 스트리밍 |
| DEV-021 | 폴더 관리 API (CRUD, 중첩) | FILE-03 | M | 재귀적 폴더 구조 |
| DEV-022 | 파일 이동/복사 API | FILE-04 | M | MinIO copy + DB 갱신 |
| DEV-023 | 파일 이름 변경 API | FILE-05 | S | 인라인 편집 |
| DEV-024 | 파일 삭제 API (소프트 삭제) | FILE-06 | S | soft_deleted_at 플래그 |
| DEV-025 | 파일 검색 API | FILE-07 | M | 파일명 기반, 범위 선택 |
| DEV-026 | 드라이브 메인 화면 (D-03) | FILE-01~07 | L | 드래그앤드롭, 다중 선택 |
| DEV-027 | 폴더 탐색 화면 (D-04) | FILE-03 | M | 브레드크럼 |
| DEV-028 | 휴지통 화면 (D-09 기본) | FILE-06 | M | 목록/복원/영구삭제 |

**산출물**: 완전한 파일 CRUD + 검색 + 기본 휴지통

---

### Phase 5: Sharing (공유 링크)

> **목적**: 공유 링크 생성 및 비로그인 접근 플로우

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-029 | 공유 링크 API (UUID URL, 비로그인) | SHARE-01 | M | 추측 불가능한 URL |
| DEV-030 | 공유 모달 (D-03/D-04) | SHARE-01 | S | 링크 생성/복사 |
| DEV-031 | 공유 링크 페이지 (D-11) | SHARE-01 | M | Layout-D, 다운로드 |
| DEV-032 | 내가 공유한 항목 (D-05) | SHARE-01 | S | 링크 목록 전용 |

**산출물**: 공유 링크 전체 플로우 (생성 → 접근 → 다운로드)

---

### Phase 6: Admin (관리자 서비스)

> **목적**: 관리자 웹 애플리케이션 + 인프라 통합

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-033 | Admin Web 초기 설정 | 인프라 | M | React 19, Layout-B |
| DEV-034 | 관리자 로그인 (A-01) | AUTH-01 | S | ADMIN 역할 검증 |
| DEV-035 | 사용자 목록 + 상세 (A-03, A-04) | ADMIN-01, ADMIN-03, ADMIN-05 | L | 조회/비활성화/삭제 |
| DEV-036 | 사용자 초대 (A-05) | ADMIN-02 | M | 초대 링크 생성/관리 |
| DEV-037 | 사용자 역할 부여 (A-04) | ADMIN-04 | M | 복수 역할 합집합 |
| DEV-038 | 스토리지 대시보드 (A-08) | ADMIN-06 | M | 전체/사용자별 사용량 |
| DEV-039 | 관리자 대시보드 (A-02) | ADMIN-06 | M | 요약 카드 + 최근 활동 |
| DEV-040 | 권한 대시보드 (A-06 읽기전용) | ADMIN-18 | M | 기본 역할 목록 + 권한 확인 |
| DEV-041 | Docker Compose 통합 | 인프라 | M | admin, notification, rabbitmq |
| DEV-042 | Nginx 도메인 라우팅 | 인프라 | S | admin.drive.skypark207.com |
| DEV-043 | E2E 검증 + 버그 수정 | 전체 | L | 전체 플로우 통합 테스트 |

**산출물**: 관리자 서비스 완성, v0.1.0 릴리스 준비 완료

---

## v0.1.0 Critical Path

### 최장 의존 체인

```
DEV-002 (DB 스키마, L)
  → DEV-003 (로그인 API, L)
    → DEV-004 (RBAC, L)
      → DEV-007 (Notification MS, XL) ──┐
      → DEV-009 (Capacitor 앱, XL) ─────┤ [순차 진행]
        → DEV-008 (Push 채널, L) ───────┤
        → DEV-010 (Push 수신, L) ───────┘
          → DEV-012 (Push 2FA 백엔드, XL) ← 모든 전제조건 합류
            → DEV-013 (2FA PC, L)
              → DEV-017 (초대 가입, L)
                → DEV-043 (E2E 검증, L)
```

### 병목 지점

| 지점 | 항목 | 이유 |
|---|---|---|
| **1순위** | DEV-012 (Push 2FA, XL) | Phase 1+2의 모든 산출물(인증 API + Notification MS + 모바일 Push)이 합류 |
| **2순위** | DEV-007 (Notification MS, XL) + DEV-009 (Capacitor, XL) | 독립적이지만 둘 다 XL. 솔로 개발이므로 순차 진행 |
| **3순위** | DEV-026 (드라이브 메인, L) | FILE-01~07 전체 API가 준비되어야 완성 가능 |

### Phase 간 의존성

```
Phase 1 (Foundation) ← 모든 Phase의 전제
  ↓
Phase 2 (Notification + Mobile) ← Phase 3 전제
  ↓
Phase 3 (2FA + Onboarding) ← 인증 완성
  ↓
Phase 4 (File Management) ← AUTH-01만 필요 (Phase 1 이후 가능하나 순차 권장)
  ↓
Phase 5 (Sharing) ← FILE-01 필요
  ↓
Phase 6 (Admin) ← Drive API 재사용, 마지막
```

---

## v0.1.1 개발 항목

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-044 | 즐겨찾기 API + 화면 (D-07) | FILE-08 | S | |
| DEV-045 | 최근 파일 API + 화면 (D-08) | FILE-09 | S | |
| DEV-046 | 정렬/보기 모드 (D-03/D-04) | FILE-10 | S | localStorage 저장 |
| DEV-047 | 프로필 관리 (D-10 편집) | AUTH-04 | S | 닉네임/비밀번호 변경 |
| DEV-048 | 내 스토리지 현황 (사이드바) | SYS-01 | S | 사용량 바 |
| DEV-049 | 휴지통 UI 고도화 (D-09) | TRASH-01 | M | 필터, 정렬, 일괄 처리 |
| DEV-050 | 공유 링크 만료/비밀번호 | SHARE-02 | M | D-11 비밀번호 입력 포함 |
| DEV-051 | 스토리지 쿼터 설정 (A-04/A-08) | ADMIN-07 | M | 사용자별 용량 제한 |

---

## v0.1.2 개발 항목

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-052 | 생체인증 | AUTH-10 | M | Capacitor Biometrics |
| DEV-053 | 대용량 파일 업로드 | FILE-11 | XL | Multipart, 청크, 이어올리기 |
| DEV-054 | 사용자 권한 공유 (D-06 활성화) | SHARE-03 | L | 폴더/파일 읽기/쓰기 권한 |
| DEV-055 | 공유 관리 화면 확장 (D-05) | SHARE-04 | M | 사용자 공유 탭 활성화 |
| DEV-056 | 커스텀 역할 CRUD (A-06/A-07) | ADMIN-17 | L | 권한 체크박스 편집 |
| DEV-057 | 공유 링크 관리 (A-09) | ADMIN-09, ADMIN-10 | M | 전체 조회 + 강제 만료 |
| DEV-058 | 시스템 모니터링 (A-10) | ADMIN-11 | L | 게이지 + 추이 차트 |
| DEV-059 | 서비스 상태 (A-11) | ADMIN-12 | M | Health Check, 30초 자동갱신 |
| DEV-060 | 회원가입 설정 (A-12) | ADMIN-13 | S | 토글 + 최대 사용자 수 |
| DEV-061 | 서비스 기본값 설정 (A-13) | ADMIN-14 | M | 쿼터/만료일/휴지통 기본값 |
| DEV-062 | 감사 로그 (A-14) | ADMIN-15 | L | 커서 페이지네이션, CSV 내보내기 |

---

## v0.2.0 개발 항목

| ID | 개발 항목 | 요구사항 | 규모 | 비고 |
|---|---|---|---|---|
| DEV-063 | 휴지통 자동 정리 | TRASH-02 | M | 스케줄러, 설정 기간 후 삭제 |
| DEV-064 | Email 채널 (SMTP) | NOTIF-03 | M | Notification MS 확장 |
| DEV-065 | 쿼터 초과 알림 | ADMIN-08 | M | 80%/90%/100% 임계치 |
| DEV-066 | 활동 통계 (A-15) | ADMIN-16 | M | 일별/주별 차트 |

---

## 요구사항 → 개발 항목 매핑

모든 49개 요구사항이 개발 항목에 매핑되어 있는지 역참조한다.

### Must (28개) → v0.1.0

| 요구사항 | 개발 항목 | Phase |
|---|---|---|
| AUTH-01 | DEV-002, DEV-003, DEV-005, DEV-006 | 1 |
| AUTH-02 | DEV-017 | 3 |
| AUTH-05 | DEV-002, DEV-004 | 1 |
| AUTH-06 | DEV-002, DEV-004 | 1 |
| AUTH-07 | DEV-012, DEV-013, DEV-014 | 3 |
| AUTH-08 | DEV-015 | 3 |
| AUTH-09 | DEV-013, DEV-016 | 3 |
| AUTH-11 | DEV-018 | 3 |
| MOBILE-01 | DEV-009 | 2 |
| MOBILE-02 | DEV-010 | 2 |
| MOBILE-03 | DEV-011 | 2 |
| NOTIF-01 | DEV-007 | 2 |
| NOTIF-02 | DEV-008 | 2 |
| FILE-01 | DEV-019, DEV-026 | 4 |
| FILE-02 | DEV-020 | 4 |
| FILE-03 | DEV-021, DEV-027 | 4 |
| FILE-04 | DEV-022 | 4 |
| FILE-05 | DEV-023 | 4 |
| FILE-06 | DEV-024, DEV-028 | 4 |
| FILE-07 | DEV-025 | 4 |
| SHARE-01 | DEV-029, DEV-030, DEV-031, DEV-032 | 5 |
| ADMIN-01 | DEV-035 | 6 |
| ADMIN-02 | DEV-036 | 6 |
| ADMIN-03 | DEV-035 | 6 |
| ADMIN-04 | DEV-037 | 6 |
| ADMIN-05 | DEV-035 | 6 |
| ADMIN-06 | DEV-038, DEV-039 | 6 |
| ADMIN-18 | DEV-040 | 6 |

### Should (20개) → v0.1.1 / v0.1.2

| 요구사항 | 버전 | 개발 항목 |
|---|---|---|
| AUTH-04 | v0.1.1 | DEV-047 |
| AUTH-10 | v0.1.2 | DEV-052 |
| FILE-08 | v0.1.1 | DEV-044 |
| FILE-09 | v0.1.1 | DEV-045 |
| FILE-10 | v0.1.1 | DEV-046 |
| FILE-11 | v0.1.2 | DEV-053 |
| TRASH-01 | v0.1.1 | DEV-049 |
| SYS-01 | v0.1.1 | DEV-048 |
| SHARE-02 | v0.1.1 | DEV-050 |
| SHARE-03 | v0.1.2 | DEV-054 |
| SHARE-04 | v0.1.2 | DEV-055 |
| ADMIN-07 | v0.1.1 | DEV-051 |
| ADMIN-09 | v0.1.2 | DEV-057 |
| ADMIN-10 | v0.1.2 | DEV-057 |
| ADMIN-11 | v0.1.2 | DEV-058 |
| ADMIN-12 | v0.1.2 | DEV-059 |
| ADMIN-13 | v0.1.2 | DEV-060 |
| ADMIN-14 | v0.1.2 | DEV-061 |
| ADMIN-15 | v0.1.2 | DEV-062 |
| ADMIN-17 | v0.1.2 | DEV-056 |

### Could (4개) → v0.2.0

| 요구사항 | 개발 항목 |
|---|---|
| TRASH-02 | DEV-063 |
| NOTIF-03 | DEV-064 |
| ADMIN-08 | DEV-065 |
| ADMIN-16 | DEV-066 |

### Won't (범위 외)

| 기능 | 사유 |
|---|---|
| 소셜 로그인 | 자체 인증 + Push 2FA 체계 우선 |
| 파일 미리보기 | NAS Media 마이크로서비스에서 담당 |
| 실시간 협업 | 소규모 사용자 대상, 불필요 |

---

## 설계 결정 기록

| # | 결정 | 근거 |
|---|---|---|
| 1 | FILE-06(Must) / TRASH-01(Should) 분리 | FILE-06은 소프트 삭제 + 기본 휴지통으로 v0.1.0. TRASH-01 UI 고도화는 v0.1.1 |
| 2 | ADMIN-18(Must) / ADMIN-17(Should) 분리 | ADMIN-18은 읽기전용 권한 대시보드로 v0.1.0. 커스텀 역할 CRUD는 v0.1.2 |
| 3 | Phase 순서: 인증 → 알림/모바일 → 2FA → 파일 → 공유 → 관리자 | Push 2FA가 인증 핵심이므로 NOTIF+MOBILE이 FILE보다 선행. Admin은 Drive API 재사용이므로 마지막 |
| 4 | v0.1.1(S 위주) vs v0.1.2(L/XL 포함) 분리 | v0.1.1은 독립적 소규모 개선으로 빠른 출시. v0.1.2는 상호 의존 있는 큰 기능 덩어리 |
| 5 | v0.1.0에 MOBILE + NOTIF 전체 포함 | Push 2FA가 인증의 핵심이므로 웹 전용 MVP 대신 전체 포함 결정 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-03-22 | 초기 릴리스 계획 수립 (v0.1.0 ~ v0.2.0, DEV-001 ~ DEV-066) |
