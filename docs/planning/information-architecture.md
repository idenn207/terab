# NAS Drive 정보 구조 (IA)

## Drive Web 사이트맵 (drive.skypark207.com)

```
drive.skypark207.com
├── /login                    # 로그인 (ID + PW 입력)
│   ├── /login/2fa            # Push 2FA 대기 (PC에서 숫자 표시, 모바일 승인 대기)
│   └── /login/backup         # 백업 코드 인증 (Push 불가 시 대체)
├── /register/:inviteCode     # 초대 기반 회원가입 (앱 우선, PC는 앱 설치 유도)
│
├── /drive                    # 드라이브 메인 (내 파일)
│   ├── /drive/:folderId      # 폴더 탐색 (중첩)
│   └── (컨텍스트 메뉴)       # 업로드 · 새 폴더 · 이름 변경 · 이동 · 복사 · 삭제 · 공유 · 다운로드
│
├── /shared                   # 공유
│   ├── /shared/by-me         # 내가 공유한 항목
│   └── /shared/with-me       # 나에게 공유된 항목
│
├── /favorites                # 즐겨찾기
├── /recent                   # 최근 파일
├── /trash                    # 휴지통 (복원 · 영구 삭제)
│
├── /settings                 # 설정
│   ├── /settings/profile     # 프로필 (닉네임 · 비밀번호 변경)
│   └── /settings/security    # 보안 (2FA 디바이스 · 백업 코드 · 신뢰기기 관리)
│
└── /s/:shareId               # 공유 링크 접근 (비로그인 가능)
    └── (비밀번호 입력 → 파일 목록 → 다운로드)
```

## Admin Web 사이트맵 (admin.drive.skypark207.com)

```
admin.drive.skypark207.com
├── /login                    # 관리자 로그인
│
├── /dashboard                # 대시보드 (스토리지 현황 · 활성 사용자 · 최근 활동 요약)
│
├── /users                    # 사용자 관리
│   ├── /users                # 사용자 목록 (이름 · 이메일 · 상태 · 역할 · 사용량)
│   ├── /users/:id            # 사용자 상세 (역할 부여 · 쿼터 설정 · 비활성화 · 삭제)
│   └── /users/invite         # 사용자 초대 (초대 링크 생성)
│
├── /roles                    # 역할/권한 관리
│   ├── /roles                # 역할 목록 (OWNER · ADMIN · USER · 커스텀)
│   ├── /roles/new            # 역할 생성 (이름 · 권한 선택)
│   └── /roles/:id            # 역할 상세/수정 (권한 편집 · 할당 사용자 목록)
│
├── /storage                  # 스토리지
│   └── /storage              # 전체 사용량 대시보드 · 사용자별 점유율
│
├── /shares                   # 공유 관리
│   └── /shares               # 활성 공유 링크 목록 (강제 만료)
│
├── /system                   # 시스템
│   ├── /system/monitor       # CPU · 메모리 · 디스크 모니터링
│   └── /system/services      # 서비스 상태 (API · DB · MinIO Health)
│
├── /settings                 # 설정
│   ├── /settings/registration # 회원가입 정책 (초대 필수 여부 · 최대 사용자 수)
│   └── /settings/defaults    # 서비스 기본값 (기본 쿼터 · 공유 링크 만료일 · 휴지통 보관 기간)
│
└── /audit                    # 감사
    ├── /audit/logs           # 활동 로그 (사용자별 · 유형별 필터)
    └── /audit/stats          # 활동 통계 (일별/주별 차트)
```

## 네비게이션 구조

### Drive Web — 좌측 사이드바

| 메뉴 | 경로 | 아이콘 | 권한 |
|------|------|--------|------|
| 내 드라이브 | `/drive` | 폴더 | `file:read` |
| 공유 항목 | `/shared` | 사용자 | `file:read` |
| 즐겨찾기 | `/favorites` | 별 | `file:read` |
| 최근 파일 | `/recent` | 시계 | `file:read` |
| 휴지통 | `/trash` | 휴지통 | `file:delete` |

- 하단: 스토리지 사용량 바 (`storage:read`)
- 상단: 검색 바 (파일명 검색)
- 우측 상단: 프로필 메뉴 (설정 · 로그아웃)

### Admin Web — 좌측 사이드바

| 메뉴 | 경로 | 아이콘 | 필요 권한 |
|------|------|--------|-----------|
| 대시보드 | `/dashboard` | 홈 | `storage:manage` |
| 사용자 관리 | `/users` | 사용자 | `user:read` |
| 역할/권한 | `/roles` | 방패 | `user:role` |
| 스토리지 | `/storage` | 하드디스크 | `storage:manage` |
| 공유 관리 | `/shares` | 링크 | `share:manage` |
| 시스템 | `/system` | 서버 | `system:monitor` |
| 설정 | `/settings` | 톱니바퀴 | `system:config` |
| 감사 로그 | `/audit` | 문서 | `audit:read` |

## 화면 목록

### Drive Web

| # | 화면 | 경로 | 설명 |
|---|------|------|------|
| D-01 | 로그인 (자격증명) | `/login` | ID + PW 입력, 신뢰기기 체크박스 |
| D-01a | 로그인 (2FA 대기) | `/login/2fa` | Push 2FA 대기, 2자리 숫자 표시, WebSocket 승인 대기 (PC Web 전용) |
| D-01b | 로그인 (백업 코드) | `/login/backup` | 백업 코드 입력으로 대체 인증 (PC Web 전용) |
| D-01c | 2FA 승인 | - (앱 내 모달) | 모바일 앱에서 숫자 매칭 승인/거부 (모바일 앱 전용) |
| D-02 | 회원가입 | `/register/:code` | 앱 우선 가입 (ID · 닉네임 · 이메일 선택 · PW), 딥링크 진입 |
| D-02a | 백업 코드 발급 | - (가입 직후 화면) | 가입 직후 백업 코드 8개 표시, 안전 보관 안내 (모바일 앱) |
| D-03 | 드라이브 메인 | `/drive` | 파일/폴더 목록, 업로드, 컨텍스트 메뉴 |
| D-04 | 폴더 탐색 | `/drive/:folderId` | 하위 폴더 탐색, 브레드크럼 |
| D-05 | 내가 공유한 항목 | `/shared/by-me` | 내가 생성한 공유 링크/권한 목록 |
| D-06 | 나에게 공유된 항목 | `/shared/with-me` | 타인이 공유한 파일/폴더 목록 |
| D-07 | 즐겨찾기 | `/favorites` | 즐겨찾기 등록된 항목 목록 |
| D-08 | 최근 파일 | `/recent` | 최근 열람/업로드 파일 목록 |
| D-09 | 휴지통 | `/trash` | 삭제된 항목 목록, 복원/영구삭제 |
| D-10 | 프로필 설정 | `/settings/profile` | 닉네임/비밀번호 변경 |
| D-10a | 보안 설정 | `/settings/security` | 2FA 디바이스 관리, 백업 코드, 신뢰기기 관리 |
| D-11 | 공유 링크 페이지 | `/s/:shareId` | 비로그인 접근, 비밀번호 입력, 다운로드 |

### Admin Web

| # | 화면 | 경로 | 설명 |
|---|------|------|------|
| A-01 | 관리자 로그인 | `/login` | 관리자 인증 |
| A-02 | 대시보드 | `/dashboard` | 스토리지/사용자/활동 요약 |
| A-03 | 사용자 목록 | `/users` | 전체 사용자 조회/필터 |
| A-04 | 사용자 상세 | `/users/:id` | 역할 부여/쿼터/비활성화/삭제 |
| A-05 | 사용자 초대 | `/users/invite` | 초대 링크 생성 |
| A-06 | 역할 목록 | `/roles` | 전체 역할 조회 |
| A-07 | 역할 생성/수정 | `/roles/new`, `/roles/:id` | 역할 이름, 권한 체크박스 편집 |
| A-08 | 스토리지 대시보드 | `/storage` | 전체/사용자별 사용량 |
| A-09 | 공유 링크 관리 | `/shares` | 활성 링크 목록, 강제 만료 |
| A-10 | 시스템 모니터링 | `/system/monitor` | CPU/메모리/디스크 차트 |
| A-11 | 서비스 상태 | `/system/services` | 컨테이너 Health 상태 |
| A-12 | 회원가입 설정 | `/settings/registration` | 초대 필수 여부, 최대 사용자 수 |
| A-13 | 서비스 기본값 | `/settings/defaults` | 기본 쿼터, 만료일, 보관 기간 |
| A-14 | 감사 로그 | `/audit/logs` | 사용자 활동 로그 |
| A-15 | 활동 통계 | `/audit/stats` | 일별/주별 활동 차트 |
