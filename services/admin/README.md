# terab admin

terab 관리자 콘솔. NAS 운영자가 사용자 초대·삭제·시스템 상태 점검을 수행하기 위한 데스크탑 전용 UI.

## 위치

```
services/admin
```

production 도메인: `https://admin.drive.skypark207.com`

## 현재 범위 (M1)

이 디렉토리는 [PRD admin-service-bootstrap](../../.claude/prds/admin-service-bootstrap.prd.md) 의 M1 (서비스 부트스트랩 + Swarm 배포) 시점 상태이다.

| 항목 | 상태 |
|---|---|
| Vite + React 19 + TS 프로젝트 골격 | ✅ |
| 2-stage Node → nginx Dockerfile | ✅ |
| SPA fallback nginx 설정 | ✅ |
| Docker Swarm 서비스 정의 (`terab_admin`) | ✅ |
| nginx 서브도메인 라우팅 (`admin.drive.skypark207.com`) | ✅ |
| 로그인 / 인증 (M2) | ❌ |
| 사용자 초대·목록 (M3) | ❌ |
| catalyst UI / hey-api codegen / axios | ❌ (M2 에서 도입) |

## 주요 명령어

```bash
make admin           # 개발 서버 (Vite, localhost:5173)
make build-admin     # 프로덕션 빌드 (dist/)
make test-admin      # vitest 실행
```

루트 `make image` 가 `terab-admin:local` 이미지 빌드까지 포함한다.

## 디렉토리 구조 (FSD)

```
services/admin/
  src/
    App.tsx         # M1 시점 placeholder
    main.tsx
    index.css
    app/            # (M2 에서 채움 — providers, router)
    pages/          # (M2/M3 에서 채움)
    widgets/
    features/
    entities/
    shared/
  Dockerfile        # builder=node:24-alpine → runtime=nginx:alpine
  nginx-spa.conf    # try_files SPA fallback
```

services/web 의 FSD 컨벤션을 그대로 따른다. 차이점은 Capacitor / mobile 미적용. 자세한 컨벤션은 [CLAUDE.md](./CLAUDE.md) 참조.
