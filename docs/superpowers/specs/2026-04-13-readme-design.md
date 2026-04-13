# README 설계 문서

**날짜:** 2026-04-13  
**대상 파일:** `README.md` (프로젝트 루트)  
**작성 배경:** 프로젝트 구조·운영 환경 세팅·오류 조치 등 다른 사람과 공유되어야 하는 내용을 단일 문서로 정리

---

## 목표 및 독자

- **1차 독자:** 본인 + Claude Code (작업 컨텍스트 참조)
- **2차 독자:** 오픈소스 사용자 (GitHub에서 발견해 self-hosting 시도)
- **범위:** clone 후 로컬 개발 환경 구성 → 운영 배포(NAS/Docker Swarm)까지 한 흐름
- **상세도:** 단계별 명령어 + 설정 옵션 수준. 심화 내부 구조 설명은 추후 별도 docs로 분리

---

## 접근 방식: 플로우 중심

읽는 순서 = 실행 순서가 되도록 구성. 트러블슈팅은 각 단계 바로 아래 인라인 테이블로 배치.  
설정 레퍼런스 테이블은 별도 섹션에 분리해 재참조 편의 제공.

---

## README 섹션 구성

### 1. 헤더 & 소개

- 프로젝트 한 줄 설명: "NAS에서 돌아가는 셀프호스팅 파일 관리 서비스"
- 기술 스택 배지: Spring Boot · React · PostgreSQL · MinIO · Docker Swarm
- **Mermaid 아키텍처 다이어그램**: `graph LR` 스타일
  - Client(Browser/Android) → Nginx → API(Spring Boot) / Web(React)
  - API → PostgreSQL, MinIO
  - Nginx ← Docker Swarm (운영) / localhost:8080 (로컬)

### 2. 사전 요구사항

**로컬 개발**
- Git, Java 21, Node.js 20+, Docker Desktop

**운영 배포 (NAS)**
- Docker Swarm 초기화 완료 (`docker swarm init`)
- GitHub Container Registry(GHCR) 인증 등록
- 외부 링크:
  - [Docker Swarm 시작하기](https://docs.docker.com/engine/swarm/swarm-tutorial/)
  - [GHCR 인증 가이드](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

### 3. 로컬 개발 환경 구성

**흐름**
```
git clone → local.env 작성 → make setup-local → make infra → make api (터미널 1) → make web (터미널 2)
```

**local.env 작성**
- `local.env.example`(없으면 `configs.env.example` + `secrets.env.example` 참조)를 복사해 값 입력
- 각 항목 한 줄 설명 포함

**make 명령어 설명**
| 명령어 | 동작 |
|---|---|
| `make setup-local` | `local.env` → `services/api/application-local.properties` 생성 |
| `make infra` | PostgreSQL + MinIO 컨테이너만 기동 |
| `make api` | Spring Boot 로컬 프로파일로 실행 |
| `make web` | Vite 개발 서버 실행 |
| `make dev-up` | 전체 서비스를 컨테이너로 기동 (통합 검증용) |

**트러블슈팅 (로컬)**
| 증상 | 원인 | 해결 |
|---|---|---|
| `Connection refused :5432` | `make infra` 미실행 또는 DB healthcheck 통과 전 API 실행 | `make infra` 후 DB 준비 확인 후 `make api` |
| `application-local.properties not found` | `make setup-local` 스킵 | `make setup-local` 실행 |
| MinIO 콘솔(9001) 접속 불가 | 포트 충돌 | `docker ps`로 점유 프로세스 확인 |
| API 환경변수 인식 불가 | `local.env` 수정 후 `make setup-local` 미재실행 | `make setup-local` 재실행 후 API 재시작 |

### 4. 운영 배포 (NAS / Docker Swarm)

**흐름**
```
configs.env 작성 → secrets.env 작성 → make setup → make stack-deploy
```

**Docker Config / Secret 개념**
- Config: 비밀이 아닌 설정값 (DB URL, MinIO 엔드포인트 등) — Swarm이 서비스에 주입
- Secret: 비밀번호·JWT 시크릿 등 민감 값 — 암호화 저장, 컨테이너 내 `/run/secrets/`로 주입
- 참고: [Docker Secrets 공식 문서](https://docs.docker.com/engine/swarm/secrets/)

**`make stack-update`**: 이미지 변경 없이 서비스 롤링 재시작 (API + Web 이미지를 latest로 업데이트)

**트러블슈팅 (운영)**
| 증상 | 원인 | 해결 |
|---|---|---|
| `config not found: db_url` (서비스 기동 실패) | `make setup` 스킵 또는 일부 키 누락 | `docker config ls` 확인 후 `make setup` 재실행 |
| `secret ... not found` | `secrets.env` 값 미입력 또는 등록 실패 | `docker secret ls` 확인, 빈 값 여부 점검 |
| 서비스가 계속 Restarting | healthcheck 실패 (DB 미준비, 설정 오류 등) | `docker service logs terab_api` 로 원인 확인 |
| `stack deploy` 후 이미지 pull 실패 | GHCR 인증 미등록 | [GHCR 인증 가이드](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) 참조 |
| `make setup` 재실행 시 `config already exists` 경고 | 기존 config 충돌 | Makefile이 자동으로 `rm` 후 재등록 — 정상 동작 |
| `make setup` 후에도 환경변수 변경이 반영 안 됨 | Swarm이 기존 config를 캐시 | `make stack-update` 로 서비스 강제 재시작 |

### 5. 설정 레퍼런스 테이블

**configs.env** (비민감 설정값)
| 키 | 설명 | 예시 | 필수 |
|---|---|---|---|
| `db_url` | JDBC URL | `jdbc:postgresql://db:5432/terab` | ✓ |
| `db_name` | DB명 | `terab` | ✓ |
| `db_user` | DB 사용자명 | `terab` | ✓ |
| `minio_endpoint` | MinIO 엔드포인트 | `http://minio:9000` | ✓ |
| `minio_root_user` | MinIO 루트 사용자 | `admin` | ✓ |
| `minio_bucket` | 기본 버킷명 | `terab` | ✓ |
| `owner_username` | 최초 오너 계정 ID | `admin` | ✓ |
| `owner_nickname` | 오너 계정 표시명 | `관리자` | ✓ |
| `jwt_access_expiry_ms` | Access token 만료 (ms) | `900000` (15분) | ✓ |
| `jwt_refresh_expiry_ms` | Refresh token 만료 (ms) | `604800000` (7일) | ✓ |

**secrets.env** (민감 값 — 절대 git 커밋 금지)
| 키 | 설명 | 필수 |
|---|---|---|
| `terab_db_password` | DB 비밀번호 | ✓ |
| `terab_minio_password` | MinIO 루트 비밀번호 | ✓ |
| `terab_jwt_secret` | JWT 서명 키 (256bit 이상 권장) | ✓ |
| `terab_owner_password` | 오너 계정 초기 비밀번호 | ✓ |
| `terab_password_pepper` | 비밀번호 해싱 pepper 값 | ✓ |

### 6. 프로젝트 구조

```
terab/
├── services/
│   ├── api/          # Spring Boot 백엔드
│   ├── web/          # React + Vite 프론트엔드 (Capacitor 포함)
│   └── nginx/        # Nginx 리버스 프록시 설정
├── volumes/          # 로컬 개발용 데이터 볼륨 (git 제외)
├── scripts/          # 유틸리티 스크립트 (secret 검증 등)
├── docs/             # 설계 문서, 기획 문서
├── docker-compose.local.yml  # 로컬 개발용
├── docker-stack.yml          # 운영(Swarm) 배포용
├── Makefile                  # 모든 명령어 진입점
├── local.env                 # 로컬 개발 환경변수 (git 제외)
├── configs.env.example       # 운영 Config 키 목록 템플릿
└── secrets.env.example       # 운영 Secret 키 목록 템플릿
```

---

## 범위 정의

이 README는 **전체 서비스 플로우 수준**의 단일 진입점 문서다.  
각 서비스의 내부 구조·설정·개발 방법은 추후 별도 문서로 분리 예정:

- `services/api/README.md` — Spring Boot API 전용 (패키지 구조, 엔드포인트, 로컬 설정 상세)
- `services/web/README.md` — React/Vite 프론트엔드 전용 (FSD 구조, 컴포넌트, Capacitor 빌드)

## 비포함 항목 (추후 별도 문서)

- API 엔드포인트 목록 → `services/api/README.md`
- 내부 아키텍처 상세 (패키지 구조, 인증 흐름 등) → `services/api/README.md`
- 프론트엔드 구조 (FSD, 상태관리) → `services/web/README.md`
- 기여 가이드 (CONTRIBUTING.md)
- 라이선스

---

## 언어 및 형식

- 한국어
- Markdown (GitHub 렌더링 기준)
- 다이어그램: Mermaid (`graph LR`)
- 트러블슈팅: 인라인 테이블 형식
