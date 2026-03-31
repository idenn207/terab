# NAS Drive 화면 명세

> Figma MCP 미연결로 텍스트 기반 화면 명세(경로 B)로 작성.
> 추후 Figma 파일 생성 시 이 문서를 기반으로 와이어프레임/목업을 제작하고, Notion embed로 교체한다.
> 각 화면 명세는 `docs/planning/screens/` 하위에 개별 파일로 관리한다.

---

## 공통

- [공통 레이아웃 패턴](screens/common-layouts.md) — Layout-A(Drive Web), Layout-B(Admin Web), Layout-C(인증), Layout-D(공유 링크)

---

## 그룹 1: 인증 화면

> **인증 체계 요약:** ID+PW → Push 2FA(숫자 매칭) + 신뢰기기 + 생체인증(앱)
> **온보딩:** 앱 우선 가입 (초대 링크 → 앱 설치 → 앱에서 가입)
> **플랫폼:** PC 브라우저(Web) + Capacitor 모바일 앱(동일 React 코드)

| 화면 ID | 화면명 | 플랫폼 | 파일 |
|---------|--------|--------|------|
| D-01 | 로그인 — 1단계: 자격증명 입력 | Web + 앱 | [D-01.md](screens/D-01.md) |
| D-01a | 로그인 — 2단계: Push 2FA 대기 | PC Web 전용 | [D-01a.md](screens/D-01a.md) |
| D-01b | 로그인 — 백업 코드 인증 | PC Web 전용 | [D-01b.md](screens/D-01b.md) |
| D-01c | 2FA 승인 모달 | 모바일 앱 전용 | [D-01c.md](screens/D-01c.md) |
| D-02 | 회원가입 | 모바일 앱 우선 | [D-02.md](screens/D-02.md) |
| D-02a | 백업 코드 발급 | 모바일 앱 | [D-02a.md](screens/D-02a.md) |
| D-10a | 디바이스 관리 (설정 > 보안) | Web + 앱 | [D-10a.md](screens/D-10a.md) |

---

## 그룹 2: 파일 관리 핵심 화면

> **핵심 기능:** 파일 업로드/다운로드, 폴더 CRUD, 이동/복사, 삭제, 검색, 정렬/뷰 전환
> **레이아웃:** Layout-A (Drive Web 기본) 공통 사용
> **관련 요구사항:** FILE-01 ~ FILE-11, TRASH-01

| 화면 ID | 화면명 | 플랫폼 | 파일 |
|---------|--------|--------|------|
| D-03 | 드라이브 메인 | Web + 앱 | [D-03.md](screens/D-03.md) |
| D-04 | 폴더 탐색 | Web + 앱 | [D-04.md](screens/D-04.md) |

---

## 그룹 3: 공유/부가 화면

> **공유 범위 (v0.1):** 링크 공유만 지원 (SHARE-01). 사용자 권한 공유(SHARE-03)는 v0.1.2에서 추가
> **레이아웃:** Layout-A 공통 (D-11만 Layout-D 독립 레이아웃)
> **관련 요구사항:** SHARE-01/02/04, FILE-08/09, TRASH-01/02, AUTH-04

| 화면 ID | 화면명 | 플랫폼 | 파일 |
|---------|--------|--------|------|
| D-05 | 내가 공유한 항목 | Web + 앱 | [D-05.md](screens/D-05.md) |
| D-06 | 나에게 공유된 항목 | Web + 앱 | v0.1.2 보류 (SHARE-03 구현 시 작성) |
| D-07 | 즐겨찾기 | Web + 앱 | [D-07.md](screens/D-07.md) |
| D-08 | 최근 파일 | Web + 앱 | [D-08.md](screens/D-08.md) |
| D-09 | 휴지통 | Web + 앱 | [D-09.md](screens/D-09.md) |
| D-10 | 프로필 설정 | Web + 앱 | [D-10.md](screens/D-10.md) |
| D-11 | 공유 링크 페이지 | Web (비로그인) | [D-11.md](screens/D-11.md) |

---

## 그룹 4: 관리자 핵심 화면

> **Admin Web 기본:** Layout-B (Header + Sidebar 8개 관리 메뉴 + Page Header + Content Area)
> **인증:** Layout-C (A-01만), 이후 모든 화면 Layout-B 공통
> **접근:** `admin.drive.skypark207.com`, ADMIN 역할 보유 사용자만 접근 가능
> **관련 요구사항:** ADMIN-01~06, ADMIN-17, ADMIN-18

| 화면 ID | 화면명 | 우선순위 | 파일 |
|---------|--------|----------|------|
| A-01 | 관리자 로그인 | Must | [A-01.md](screens/A-01.md) |
| A-02 | 대시보드 | Must | [A-02.md](screens/A-02.md) |
| A-03 | 사용자 목록 | Must | [A-03.md](screens/A-03.md) |
| A-04 | 사용자 상세 | Must | [A-04.md](screens/A-04.md) |
| A-05 | 사용자 초대 | Must | [A-05.md](screens/A-05.md) |
| A-06 | 역할 목록 | Should | [A-06.md](screens/A-06.md) |
| A-07 | 역할 생성/수정 | Should | [A-07.md](screens/A-07.md) |
| A-08 | 스토리지 대시보드 | Must | [A-08.md](screens/A-08.md) |

---

## 그룹 5: 관리자 부가 화면

> **Admin Web 부가 기능**: 공유 관리, 시스템 모니터링, 서비스 설정, 감사/통계
> **레이아웃**: Layout-B (Admin Web 기본)
> **설계 결정**: A-10 갱신 주기 사용자 선택(5/10/30/60초), A-11 30초 자동+수동 Health Check, A-14 커서 기반 페이지네이션+모달 상세
> **새 컴포넌트**: Toggle Switch, 게이지 차트, 라인/바 차트, DateRangePicker, Multi-select 드롭다운, 서비스 상태 카드

| 화면 ID | 화면명 | 우선순위 | 파일 |
|---------|--------|----------|------|
| A-09 | 공유 링크 관리 | Should | [A-09.md](screens/A-09.md) |
| A-10 | 시스템 모니터링 | Should | [A-10.md](screens/A-10.md) |
| A-11 | 서비스 상태 | Should | [A-11.md](screens/A-11.md) |
| A-12 | 회원가입 설정 | Should | [A-12.md](screens/A-12.md) |
| A-13 | 서비스 기본값 | Should | [A-13.md](screens/A-13.md) |
| A-14 | 감사 로그 | Should | [A-14.md](screens/A-14.md) |
| A-15 | 활동 통계 | Could | [A-15.md](screens/A-15.md) |
