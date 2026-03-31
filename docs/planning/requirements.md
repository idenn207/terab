# NAS Drive 요구사항 정의서

## 기능 요구사항

### 인증/사용자 관리

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| AUTH-01 | 자체 로그인 | ID + PW 기반 로그인, Push 2FA 필수 (GitHub 스타일 숫자 매칭), JWT 토큰 발급 | Must | L | - |
| AUTH-02 | 초대 기반 가입 | 초대 링크 → 딥링크 → 모바일 앱에서 가입 (앱 우선 가입). ID · 닉네임 · 비밀번호 필수, 이메일 선택 | Must | L | AUTH-01, MOBILE-01 |
| AUTH-04 | 프로필 관리 | 닉네임, 비밀번호 변경 | Should | S | AUTH-01 |
| AUTH-05 | 권한 체계 (RBAC) | `리소스:액션` 단위 권한 정의, 역할(권한 묶음) → 사용자 부여 방식. AWS IAM 유사 구조 | Must | L | AUTH-01 |
| AUTH-06 | 기본 역할 | OWNER/ADMIN/USER 3개 기본 역할 자동 생성. OWNER는 환경변수로 초기 지정 | Must | M | AUTH-05 |
| AUTH-07 | Push 2FA | GitHub 스타일 숫자 매칭 2단계 인증. PC에 2자리 숫자 표시 → 모바일에서 동일 숫자 입력 승인 | Must | XL | AUTH-01, MOBILE-01, NOTIF-01 |
| AUTH-08 | 신뢰기기 | "이 기기를 신뢰" 체크 시 30일간 2FA 스킵. 보안 설정에서 신뢰 해제 가능 | Must | M | AUTH-07 |
| AUTH-09 | 백업 코드 | 가입 시 8개 1회용 코드 발급 (bcrypt 해싱 저장). Push 2FA 불가 시 대체 인증 수단 | Must | M | AUTH-07 |
| AUTH-10 | 생체인증 | 모바일 앱에서 지문/Face ID로 간편 로그인 (Capacitor Biometrics 플러그인) | Should | M | MOBILE-01 |
| AUTH-11 | 디바이스 관리 | 등록된 2FA 디바이스 목록 조회, 주 디바이스 설정, 추가/제거. 최소 1개 디바이스 필수 | Must | M | AUTH-07 |

### 모바일 앱

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| MOBILE-01 | Capacitor 하이브리드 앱 | React 웹앱을 Capacitor로 네이티브 래핑. iOS/Android WebView + 네이티브 브릿지 | Must | XL | - |
| MOBILE-02 | Push 알림 | FCM(Android)/APNs(iOS) 기반 Push 알림 수신. 2FA 승인, 공유 알림 등 | Must | L | NOTIF-01 |
| MOBILE-03 | 딥링크 | Universal Links(iOS)/App Links(Android) 지원. 초대 링크 → 앱 실행 연동 | Must | M | MOBILE-01 |

### 파일 관리

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| FILE-01 | 파일 업로드 | 단일/다중 파일 업로드, 드래그&드롭, 진행률 표시 | Must | L | AUTH-01 |
| FILE-02 | 파일 다운로드 | 단일 파일 다운로드, 다중 선택 시 ZIP 묶음 | Must | M | FILE-01 |
| FILE-03 | 폴더 관리 | 폴더 생성/이름 변경/이동/삭제, 중첩 폴더 | Must | M | - |
| FILE-04 | 파일 이동/복사 | 파일을 다른 폴더로 이동 또는 복사 | Must | M | FILE-03 |
| FILE-05 | 파일 이름 변경 | 파일/폴더 이름 인라인 편집 | Must | S | - |
| FILE-06 | 파일 삭제 | 파일/폴더 삭제 → 휴지통 이동 | Must | S | TRASH-01 |
| FILE-07 | 파일 검색 | 파일명 기반 검색, 현재 폴더/전체 범위 선택 | Must | M | - |
| FILE-08 | 즐겨찾기 | 파일/폴더 즐겨찾기 등록/해제, 즐겨찾기 목록 조회 | Should | S | - |
| FILE-09 | 최근 파일 | 최근 열람/업로드한 파일 목록 | Should | S | - |
| FILE-10 | 정렬/보기 모드 | 이름/날짜/크기 정렬, 리스트/그리드 뷰 전환 | Should | S | - |
| FILE-11 | 대용량 파일 업로드 | Multipart 업로드, 청크 분할, 이어올리기 | Should | XL | FILE-01 |

### 휴지통

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| TRASH-01 | 휴지통 | 삭제된 파일 목록 조회, 복원/영구삭제 | Should | M | FILE-06 |
| TRASH-02 | 자동 정리 | 설정 기간(기본 30일) 경과 시 자동 영구삭제 | Could | M | TRASH-01 |

### 공유

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| SHARE-01 | 공유 링크 생성 | 파일/폴더에 대한 공유 URL 생성 (비로그인 접근 가능) | Must | M | FILE-01 |
| SHARE-02 | 링크 만료/비밀번호 | 공유 링크에 만료일 설정, 선택적 비밀번호 보호 | Should | M | SHARE-01 |
| SHARE-03 | 사용자 권한 공유 | 특정 사용자에게 폴더/파일 읽기 또는 쓰기 권한 부여 | Should | L | AUTH-01, FILE-03 |
| SHARE-04 | 공유 관리 | 내가 공유한 항목, 나에게 공유된 항목 목록 조회 | Should | M | SHARE-01, SHARE-03 |

### 시스템 (드라이브 앱)

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| SYS-01 | 내 스토리지 현황 | 본인 사용량 표시 (쿼터 대비 사용률) | Should | S | - |

### 관리자 서비스 (admin.drive.skypark207.com)

#### 사용자 관리

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| ADMIN-01 | 사용자 목록 | 전체 사용자 조회 (이름, 이메일, 상태, 가입일, 마지막 접속) | Must | S | AUTH-01 |
| ADMIN-02 | 사용자 초대 | 초대 링크/코드 생성 및 발송 | Must | M | AUTH-02 |
| ADMIN-03 | 사용자 비활성화/삭제 | 계정 비활성화(로그인 차단) 또는 영구 삭제 | Must | M | ADMIN-01 |
| ADMIN-04 | 사용자 역할 부여 | 사용자에게 역할 부여/회수 (복수 역할 가능, 최종 권한 = 합집합) | Must | M | AUTH-05, ADMIN-01 |
| ADMIN-05 | 사용자별 스토리지 조회 | 사용자별 사용량, 파일 수, 최근 활동 | Must | M | SYS-01 |

#### 스토리지 관리

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| ADMIN-06 | 스토리지 대시보드 | 전체 사용량, 잔여 용량, 사용자별 점유율 차트 | Must | M | - |
| ADMIN-07 | 스토리지 쿼터 설정 | 사용자별 용량 제한 설정/변경 | Should | M | ADMIN-05 |
| ADMIN-08 | 쿼터 초과 알림 | 사용량이 임계치(80%, 90%, 100%) 도달 시 알림 | Could | M | ADMIN-07 |

#### 공유 관리

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| ADMIN-09 | 공유 링크 전체 조회 | 활성 공유 링크 목록 (생성자, 대상, 만료일, 접근 수) | Should | M | SHARE-01 |
| ADMIN-10 | 공유 링크 강제 만료 | 문제 있는 공유 링크 즉시 비활성화 | Should | S | ADMIN-09 |

#### 시스템 모니터링

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| ADMIN-11 | 시스템 상태 | CPU, 메모리, 디스크 사용량 실시간 표시 | Should | L | - |
| ADMIN-12 | 서비스 상태 | API, MinIO, DB 컨테이너 Health 상태 조회 | Should | M | - |

#### 서비스 설정

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| ADMIN-13 | 회원가입 설정 | 초대 필수 여부, 최대 사용자 수 제한 | Should | S | AUTH-02 |
| ADMIN-14 | 서비스 설정 관리 | 기본 쿼터, 공유 링크 기본 만료일, 휴지통 보관 기간 등 | Should | M | - |

#### 감사/통계

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| ADMIN-15 | 감사 로그 | 사용자 행위 기록 (로그인, 파일 업로드/삭제/공유, 설정 변경) | Should | L | - |
| ADMIN-16 | 활동 통계 | 일별/주별 업로드 수, 활성 사용자 수, 공유 링크 생성 수 | Could | M | ADMIN-15 |
| ADMIN-17 | 역할 관리 | 커스텀 역할 CRUD, 역할별 권한(`리소스:액션`) 편집 | Should | L | AUTH-05 |
| ADMIN-18 | 권한 대시보드 | 역할 목록 조회, 역할별 포함 권한 확인, 사용자별 최종 권한 조회 | Should | M | ADMIN-17 |

### 알림 서비스

| ID | 기능 | 설명 | 우선순위 | 복잡도 | 의존성 |
|---|---|---|---|---|---|
| NOTIF-01 | Notification 마이크로서비스 | MQ 기반 독립 알림 서비스. API에서 이벤트 발행 → MQ → Notification MS 소비 → 채널별 전송 | Must | XL | - |
| NOTIF-02 | Push 채널 (FCM/APNs) | Firebase Cloud Messaging / Apple Push Notification Service 연동 | Must | L | NOTIF-01 |
| NOTIF-03 | Email 채널 (SMTP) | 선택적 이메일 알림 (쿼터 경고, 보안 알림 등). 사용자가 이메일 등록 시에만 동작 | Could | M | NOTIF-01 |

## 비기능 요구사항

| 항목 | 요구사항 | 기준 |
|---|---|---|
| **성능** | 파일 목록 로딩 | 1000개 파일 기준 < 2초 |
| **성능** | 파일 업로드 속도 | NAS 네트워크 대역폭의 80% 이상 활용 |
| **보안** | 인증 | ID + PW + Push 2FA 필수, JWT 기반 토큰 (Access + Refresh), 비밀번호/백업코드 bcrypt 해싱 |
| **보안** | 데이터 격리 | 사용자간 파일 접근 차단 (공유 설정 시에만 허용) |
| **보안** | 공유 링크 | 추측 불가능한 UUID 기반 URL |
| **보안** | 관리자 API | ADMIN 역할 검증 필수, 일반 사용자 접근 차단 |
| **보안** | 2FA | Push 2FA 60초 타임아웃, 신뢰기기 30일 만료, 백업 코드 8개 (1회용) |
| **보안** | 실시간 통신 | WebSocket/SSE로 2FA 승인 결과 PC 브라우저에 실시간 전달 |
| **확장성** | 마이크로서비스 | NAS Media 등 별도 서비스와 API 연동 가능한 구조 |
| **가용성** | 배포 | Docker 기반, Watchtower 자동 업데이트 |
| **UX** | 반응형/모바일 | PC 웹 우선, Capacitor 하이브리드 앱으로 모바일 동시 지원 (v0.1.0) |

## MoSCoW 요약

| 우선순위 | 기능 ID | 비고 |
|---|---|---|
| **Must** (v0.1 필수) | AUTH-01, AUTH-02, AUTH-05~09, AUTH-11, MOBILE-01~03, NOTIF-01~02, FILE-01~07, SHARE-01, ADMIN-01~06, ADMIN-18 | 인증(Push 2FA) + 모바일 앱 + 알림 + 기본 파일 관리 + RBAC |
| **Should** (v0.1 목표) | AUTH-04, AUTH-10, FILE-08~11, TRASH-01, SHARE-02~04, SYS-01, ADMIN-07, ADMIN-09~15, ADMIN-17 | UX 향상 + 생체인증 + 공유 고도화 + 커스텀 역할 + 관리 고급 기능 |
| **Could** (v0.2+) | TRASH-02, NOTIF-03, ADMIN-08, ADMIN-16 | 자동 정리, Email 알림, 쿼터 알림, 통계 |
| **Won't** (범위 외) | 소셜 로그인, 파일 미리보기, 실시간 협업 | 미리보기는 NAS Media |

## 인프라 구조

```
services/
├── api/          # Spring Boot 백엔드 (드라이브 + 관리자 API 공용)
├── web/          # React 프론트엔드 (드라이브) — drive.skypark207.com
├── admin/        # React 프론트엔드 (관리자) — admin.drive.skypark207.com
├── mobile/       # Capacitor 모바일 앱 (React WebView 래핑)
├── notification/ # Notification MS (MQ 기반 Push/Email 전송)
└── nginx/        # 리버스 프록시 (도메인 라우팅)
```

- 백엔드 API는 하나로 유지, 관리자 전용 엔드포인트는 ADMIN 역할 검증으로 보호
- 모바일 앱은 Drive Web과 동일 React 코드를 Capacitor로 래핑 (WebView + 네이티브 브릿지)
- 초기 관리자 계정은 환경변수(`ADMIN_ID`, `ADMIN_PASSWORD`)로 자동 생성
- 복수 관리자 지원 (관리자가 다른 사용자에게 ADMIN 역할 부여)
- Notification MS는 MQ를 통해 API와 비동기 통신, Push(FCM/APNs) + 선택적 Email 처리
