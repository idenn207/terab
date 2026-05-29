---
name: admin-service-bootstrap
description: services/admin 신규 React + Vite + TS 서비스 부트스트랩 (M1) — NAS Docker Swarm 배포 + admin.drive.skypark207.com 라우팅 + 헬스체크 통과
status: done
created: 2026-05-28
completed: 2026-05-28
report: .claude/PRPs/reports/admin-service-bootstrap-report.md
---

# Plan: services/admin 부트스트랩 + admin.drive.skypark207.com 배포

**Source PRD**: [.claude/prds/admin-service-bootstrap.prd.md](../prds/admin-service-bootstrap.prd.md)
**Selected Milestone**: M1 — services/admin 부트스트랩 + admin.drive.skypark207.com 배포
**Complexity**: Medium (코드는 적지만 인프라 surface 가 넓음 — Dockerfile, nginx, swarm stack, CI, Makefile)

## Summary

services/web 의 부트스트랩 구조(2-stage Node→nginx Dockerfile, Vite, FSD `src/` 스켈레톤, GHCR 이미지 + Swarm rolling update)를 그대로 미러한 `services/admin` 을 신설한다. 단, 본 M1 의 outcome 은 **"admin.drive.skypark207.com 에서 빈 페이지가 뜨고 헬스체크 통과"** 이므로 catalyst UI / hey-api codegen / axios / 인증 / FSD features 는 본 plan scope **밖**이며 M2 에서 추가한다. Capacitor 도 제외(데스크탑 전용 정책).

본 plan 은 NAS Docker Swarm 에 신규 서비스 1개를 정상 stack 으로 띄우는 배포 파이프라인 검증에 가깝다. 코드 line 수보다 인프라 yaml/conf 변경 정확성이 risk 의 중심이다.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 2-stage Dockerfile (Node→nginx) | [services/web/Dockerfile](../../services/web/Dockerfile) | builder=node:24-alpine + runtime=nginx:alpine, COPY dist→/usr/share/nginx/html, EXPOSE 80 |
| SPA fallback nginx 설정 | [services/web/nginx-spa.conf](../../services/web/nginx-spa.conf) | `try_files $uri $uri/ /index.html` + 정적 캐시 1y |
| Vite + React 19 + TS 패키지 구조 | [services/web/package.json](../../services/web/package.json) | private/type=module, scripts: dev/build/test/lint/preview |
| Swarm 서비스 정의 + healthcheck + rolling update | [docker-stack.yml:186-211 (web 블록)](../../docker-stack.yml) | env_file, healthcheck (curl 80), replicas, update_config order=start-first, ghcr.io 이미지 |
| nginx 서브도메인 라우팅 | [services/nginx/conf.d/server.conf](../../services/nginx/conf.d/server.conf) | server_name + http→https redirect + `/api/` proxy_pass + `/` proxy_pass to upstream |
| CI matrix 빌드/배포 | [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) | test-{svc} job + matrix build-and-push + cleanup + deploy(self-hosted) docker service update |
| Makefile 서비스 타겟 | [Makefile:108,124-125,184-185](../../Makefile) | image: docker build per service, build-{svc}: npm run build, test-{svc}: npm test |
| FSD 디렉토리 스켈레톤 | [services/web/src/](../../services/web/src/) | app/pages/widgets/features/entities/shared 6개 — M1 에는 빈 디렉토리 + main.tsx 만 |
| plan/PRD frontmatter 컨벤션 | [.claude/plans/README.md:25-44](README.md) | name/description/status/created |

> **새 패턴 발명 금지**. services/web 과의 1:1 미러가 본 plan 의 검증 가치이다. 차이를 만드는 경우 본 plan 의 Tasks 에 명시한다.

## Files to Change

### CREATE — services/admin 본체

| File | Action | Why |
|---|---|---|
| `services/admin/package.json` | CREATE | name=`terab-admin`, web 의 dev 의존성 중 React/Vite/TS/Vitest/ESLint/Prettier/TailwindCSS 만 포함. catalyst/hey-api/axios/zustand/react-router/capacitor 일체 **제외** (M2 에서 추가) |
| `services/admin/package-lock.json` | CREATE | `npm install` 결과물 commit |
| `services/admin/tsconfig.json` | CREATE | web 의 tsconfig.json 복제 (project references) |
| `services/admin/tsconfig.app.json` | CREATE | web 의 tsconfig.app.json 복제, baseUrl/paths 동일 |
| `services/admin/tsconfig.node.json` | CREATE | web 의 것 복제 |
| `services/admin/vite.config.ts` | CREATE | web 의 vite.config.ts 복제. Capacitor 관련 옵션 제거 (있다면) |
| `services/admin/eslint.config.js` | CREATE | web 의 것 복제 |
| `services/admin/index.html` | CREATE | `<title>terab admin</title>`, root div, main.tsx 진입 |
| `services/admin/nginx-spa.conf` | CREATE | web 의 nginx-spa.conf 그대로 복제 (서브도메인 정보 없음 — 본 conf 는 컨테이너 80 포트 SPA fallback 만 담당) |
| `services/admin/Dockerfile` | CREATE | web 의 Dockerfile 그대로 복제 (LF — Linux 컨테이너) |
| `services/admin/.dockerignore` | CREATE | node_modules, dist, .git, src/__tests__ 등 — web 에 동일 파일이 있다면 미러, 없으면 최소 항목 |
| `services/admin/.gitignore` | CREATE | node_modules, dist, .env.local, coverage — web 미러 |
| `services/admin/README.md` | CREATE | 1-2 단락 — 목적 (admin 부트스트랩), `make admin` / `make build-admin` 명령 안내, M2/M3 미구현 명시 |
| `services/admin/CLAUDE.md` | CREATE | "services/web/CLAUDE.md 의 FSD/컨벤션을 그대로 따른다" + 차이점 (Capacitor/모바일 없음, M1 시점 features 비어 있음) 정도의 1페이지 |
| `services/admin/public/.gitkeep` | CREATE | 빈 디렉토리 보존 |
| `services/admin/src/main.tsx` | CREATE | `createRoot(...).render(<App />)` |
| `services/admin/src/App.tsx` | CREATE | `<main><h1>terab admin</h1><p>M1 부트스트랩 완료. M2 에서 로그인 추가 예정.</p></main>` 정도. 라우터 없음 |
| `services/admin/src/index.css` | CREATE | web 미러 (TailwindCSS 4 import 한 줄) |
| `services/admin/src/app/.gitkeep` | CREATE | FSD 스켈레톤 빈 디렉토리 |
| `services/admin/src/pages/.gitkeep` | CREATE | 동상 |
| `services/admin/src/widgets/.gitkeep` | CREATE | 동상 |
| `services/admin/src/features/.gitkeep` | CREATE | 동상 |
| `services/admin/src/entities/.gitkeep` | CREATE | 동상 |
| `services/admin/src/shared/.gitkeep` | CREATE | 동상 |

> **EOL 정책**: src 파일·tsconfig·vite.config·eslint.config 는 CRLF (Windows 개발 환경 기본, [CLAUDE.md §"코드 작성 spec"](../../CLAUDE.md)). Dockerfile / nginx-spa.conf / .dockerignore 는 LF (Linux 컨테이너 실행 파일). package.json / tsconfig*.json 은 CRLF.

### CREATE — 환경 변수 / secret

| File | Action | Why |
|---|---|---|
| `admin.env.example` | CREATE | M1 에는 의미 있는 env 가 없으나 다른 서비스와 형식 일관성을 위해 빈 placeholder 파일 + 주석으로 "M2 에서 VITE_API_BASE 등 추가" 명시. 루트 위치 ([CLAUDE.md §"환경 설정"](../../CLAUDE.md)) |
| `admin.env` | CREATE (gitignore 대상이면 skip) | 로컬용. 기존 `web.env` 가 `.gitignore` 처리되는지 먼저 확인 |

### UPDATE — 인프라/CI/Makefile

| File | Action | Why |
|---|---|---|
| `services/nginx/conf.d/admin.conf` | CREATE | 신규 server block. `server_name admin.drive.skypark207.com`, http→https redirect, `location /` → `proxy_pass http://admin:80`. **기존 server.conf 비편집** (회귀 risk 차단) |
| `docker-stack.yml` | UPDATE | "React Frontend" web 블록 바로 아래에 `admin:` 서비스 추가 — image `ghcr.io/idenn207/terab-admin:latest`, env_file `admin.prod.env`, healthcheck (curl 80), replicas=1 (web 은 2지만 admin 은 사용자 1~2명 대상이라 1로 충분), update_config order=start-first |
| `.github/workflows/deploy.yml` | UPDATE | (1) `test-admin` job 추가 (test-web 미러). (2) `build-and-push` matrix 에 `admin` 추가. (3) `cleanup` matrix.package 에 `terab-admin` 추가. (4) deploy job 에 "Update admin service" step 추가 |
| `Makefile` | UPDATE | `build-admin`, `test-admin`, `admin` (dev server), `image` 타겟에 `docker build -t terab-admin:local ./services/admin` 추가, `dev-update` 와 `stack-update` 에 `terab_admin` rolling update 추가. `build:` 의존성에 `build-admin` 추가 |
| `docker-stack.local.yml` | UPDATE | dev 스택에도 admin 추가 (로컬 image 사용) — web 의 local override 와 동일한 형식 미러 |
| `infra.prod.env` / `web.prod.env` 등 | NOT CHANGED | admin 전용 env 는 신규 `admin.prod.env` 로 분리. 기존 env 파일 비편집 (Claude 행동 지침 — 기존 설정값 덮어쓰기 금지) |

### UPDATE — PRD 메타데이터

| File | Action | Why |
|---|---|---|
| `.claude/prds/admin-service-bootstrap.prd.md` | UPDATE | Delivery Milestones 표의 M1 row: `Status pending → in-progress`, `Plan` 셀에 `.claude/plans/admin-service-bootstrap.plan.md` 기입. **나머지 row 비편집** |

## Tasks

> 각 Task 는 단일 검증 가능 단위. TDD 우선이지만 본 plan 대부분이 인프라 yaml/conf 이므로 "실제 컨테이너 기동/curl 확인" 이 우선 검증 수단이 된다.

### Task 1: services/admin 디렉토리 + 빈 Vite/React 19 부트스트랩

- **Action**:
  1. `services/web/{package.json,tsconfig*.json,vite.config.ts,eslint.config.js,index.html,nginx-spa.conf,Dockerfile,src/main.tsx,src/index.css}` 복제 → `services/admin/` 으로
  2. `package.json` name = `terab-admin`, version `0.1.0`, **dependencies 정리**: react, react-dom, @tailwindcss/vite, tailwindcss, prettier-plugin-tailwindcss, tailwind-merge, clsx 만 유지. **제거**: capacitor*, hey-api*, axios, @tanstack/react-query, react-hook-form, react-router-dom, zustand, motion, @headlessui/react, @heroicons/react, cva
  3. `package.json` devDependencies: TS/Vite/ESLint/Prettier/Vitest/@testing-library/* 만 유지. **제거**: cross-env, msw
  4. `package.json` scripts: `dev/build/preview/lint/test/test:watch/test:coverage` 만. cap:* / openapi:codegen 제거
  5. `index.html` `<title>` = `terab admin`, lang="ko"
  6. `src/App.tsx` 신규 — `<main><h1>terab admin</h1><p>M1 부트스트랩 완료.</p></main>` (라우터 없음, 인증 없음)
  7. `src/{app,pages,widgets,features,entities,shared}/.gitkeep` 빈 디렉토리 6개 + `src/public/.gitkeep`
- **Mirror**: services/web/* 그대로. 새 컨벤션 발명 금지
- **Validate**:
  ```bash
  cd services/admin
  npm install
  npm run build                  # tsc -b && vite build — dist/index.html 생성 확인
  npm run lint                   # eslint 통과
  npm test                       # vitest run — 테스트 0건 또는 placeholder 1건 OK
  npm run dev                    # http://localhost:5173 에서 "terab admin" 헤드라인 확인
  ```

### Task 2: Dockerfile + nginx-spa.conf 로 컨테이너 빌드 + 로컬 기동 검증

- **Action**:
  1. `services/admin/Dockerfile` 은 web 의 Dockerfile 그대로 복제 (LF). 빌드 컨텍스트 주석 `# Build context: ./services/admin` 으로 수정
  2. `services/admin/nginx-spa.conf` 는 web 의 것 그대로 복제 (LF)
  3. `services/admin/.dockerignore` — node_modules, dist, .git, src/__tests__, coverage 포함
- **Mirror**: services/web/{Dockerfile,nginx-spa.conf,.dockerignore}
- **Validate**:
  ```bash
  cd c:/_project/my/terab/.worktrees/admin-service-bootstrap
  docker build -t terab-admin:local ./services/admin
  docker run --rm -d -p 18080:80 --name terab-admin-smoke terab-admin:local
  curl -sf http://localhost:18080/ | grep -i 'terab admin'   # SPA fallback 동작
  curl -sf http://localhost:18080/some/unknown/path | grep -i 'terab admin'  # SPA 라우팅 fallback
  docker rm -f terab-admin-smoke
  ```

### Task 3: nginx 서브도메인 server block 추가 (admin.drive.skypark207.com)

- **Action**:
  1. `services/nginx/conf.d/admin.conf` 신규 생성. server.conf 의 구조 미러:
     - `listen 80; server_name admin.drive.skypark207.com;`
     - `if ($http_x_forwarded_proto = "http") { return 301 https://$host$request_uri; }`
     - `location /api/ { ... proxy_pass http://api:3000; ... }` — admin 도 동일 api 컨테이너 사용 (PRD: 동일 토큰 + ADMIN role claim 정책)
     - `location / { set $admin http://admin:80; proxy_pass $admin; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }`
  2. `server.conf` **비편집**
- **Mirror**: services/nginx/conf.d/server.conf 의 구조 그대로
- **Validate**:
  ```bash
  # 로컬 syntax 검증 (NAS 배포 전)
  docker run --rm -v "$(pwd)/services/nginx/conf.d:/etc/nginx/conf.d:ro" \
    -v "$(pwd)/services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
    nginx:mainline nginx -t
  # → "syntax is ok" + "test is successful" 확인
  ```

### Task 4: docker-stack.yml 에 admin 서비스 정의 추가

- **Action**:
  1. `docker-stack.yml` 의 `web:` 블록 (line 186-211) 직후에 `admin:` 블록 삽입
  2. web 블록 미러: image `ghcr.io/idenn207/terab-admin:latest`, env_file `admin.prod.env`, networks `terab-net`, healthcheck (`curl -f http://localhost:80/`), replicas **1**, update_config order=start-first
  3. **web 블록 비편집**
- **Mirror**: docker-stack.yml:186-211 (web 블록)
- **Validate**:
  ```bash
  docker stack config -c docker-stack.yml > /dev/null   # 또는 docker-compose config (yaml 문법 확인)
  grep -A 2 'admin:' docker-stack.yml | head -5
  ```

### Task 5: docker-stack.local.yml 에도 admin 추가 + Makefile 갱신

- **Action**:
  1. `docker-stack.local.yml` 의 web 로컬 override 패턴 미러 — `admin:` 추가 (image `terab-admin:local`)
  2. `Makefile`:
     - `build:` 의존성에 `build-admin` 추가
     - `build-admin:` 타겟 추가 (`cd services/admin && npm run build`)
     - `admin:` 타겟 추가 (`cd services/admin && npm run dev`)
     - `test-admin:` 타겟 추가 + `test:` 의존성에 추가
     - `image:` 에 `docker build -t terab-admin:local ./services/admin` 추가
     - `dev-update:` 와 `stack-update:` 에 `terab_admin` rolling update step 추가
- **Mirror**: Makefile 의 web 관련 타겟 전부
- **Validate**:
  ```bash
  make build-admin               # services/admin 빌드 성공
  make test-admin                # vitest 통과
  make image                     # 4개 이미지 모두 빌드 (api, mq, web, admin)
  ```

### Task 6: admin.env.example 생성 + 루트 .gitignore 확인

- **Action**:
  1. `admin.env.example` 신규 — 빈 파일 + 주석 `# M1 시점에 admin 전용 env 없음. M2 에서 VITE_API_BASE 등 추가 예정.`
  2. 루트 `.gitignore` 확인 — `*.env` 패턴이 이미 있는지. 있다면 `admin.env` 도 자동 ignore. 없으면 별도 처리 (web.env 가 ignored 인지로 검증)
- **Mirror**: web.env.example, api.env.example, mq.env.example
- **Validate**:
  ```bash
  git check-ignore admin.env || echo "WARNING: admin.env not gitignored"
  git status --short | grep -E '^\?\? admin\.env$' && echo "BAD: admin.env tracked" || echo "OK"
  ```

### Task 7: .github/workflows/deploy.yml 에 admin job 추가

- **Action**:
  1. `test-web` job 직후에 `test-admin` job 추가 (cache-dependency-path 만 admin 으로 변경)
  2. `build-and-push.strategy.matrix.include` 에 `{service: admin, context: ./services/admin}` 추가
  3. `build-and-push.needs` 에 `test-admin` 추가
  4. `cleanup.strategy.matrix.package` 에 `terab-admin` 추가
  5. `deploy` job 에 "Update admin service" step 추가 (web step 미러)
- **Mirror**: deploy.yml 의 web 관련 모든 위치
- **Validate**:
  ```bash
  # YAML 문법 + GitHub Actions 키 검증
  npx --yes -p js-yaml js-yaml .github/workflows/deploy.yml > /dev/null
  # 시각 검증: web 패턴이 admin 으로 정확히 미러되었는지 diff 로 확인
  grep -c 'admin' .github/workflows/deploy.yml   # 5+ 일치 (test job, matrix, cleanup, deploy step 등)
  ```

### Task 8: NAS 운영 환경 배포 + admin.drive.skypark207.com smoke test

> 이 Task 는 GitHub Actions self-hosted runner 가 NAS 에서 자동 수행. 본인은 (a) NAS DNS 에 `admin.drive.skypark207.com` 추가, (b) DSM Application Portal 에 admin 서브도메인 라우팅 추가, (c) `admin.prod.env` 생성, (d) merge 후 curl 검증.

- **Action**:
  1. PR merge 전 NAS 측 준비: DSM Application Portal 에 `admin.drive.skypark207.com` → terab nginx 컨테이너 (port 8080) 라우팅 추가. 인증서는 기존 wildcard `*.drive.skypark207.com` 가 있다면 자동 적용, 없으면 Let's Encrypt 발급
  2. NAS `/volume3/docker/terab/admin.prod.env` 생성 (빈 파일 또는 placeholder)
  3. v0.1 → master merge → CI deploy job 자동 실행
  4. NAS smoke test
- **Validate**:
  ```bash
  # NAS 서비스 상태 (NAS 콘솔)
  docker service ls | grep terab_admin
  docker service ps terab_admin --no-trunc

  # 외부 도메인 응답
  curl -I https://admin.drive.skypark207.com/                       # HTTP/2 200
  curl -s https://admin.drive.skypark207.com/ | grep -i 'terab admin'
  curl -s https://admin.drive.skypark207.com/foo/bar | grep -i 'terab admin'  # SPA fallback

  # 헬스체크
  docker service inspect terab_admin --format '{{ .Spec.TaskTemplate.ContainerSpec.Healthcheck }}'
  ```

## Validation

본 plan 의 acceptance 는 아래 명령이 모두 성공해야 한다.

```bash
# (1) 로컬 빌드 & 테스트
cd c:/_project/my/terab/.worktrees/admin-service-bootstrap
make build-admin
make test-admin
make image                                  # 4개 이미지 빌드 성공

# (2) 로컬 컨테이너 smoke
docker run --rm -d -p 18080:80 --name terab-admin-smoke terab-admin:local
curl -sf http://localhost:18080/ | grep -i 'terab admin'
docker rm -f terab-admin-smoke

# (3) nginx config 문법
docker run --rm \
  -v "$(pwd)/services/nginx/conf.d:/etc/nginx/conf.d:ro" \
  -v "$(pwd)/services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  nginx:mainline nginx -t

# (4) docker-stack.yml 문법
docker stack config -c docker-stack.yml > /dev/null

# (5) CI workflow yaml 문법
npx --yes -p js-yaml js-yaml .github/workflows/deploy.yml > /dev/null

# (6) NAS 운영 (deploy job 자동 수행 후)
curl -I https://admin.drive.skypark207.com/   # 200
docker service ps terab_admin                 # NAS 콘솔에서 Running 1/1

# (7) 회귀 — 기존 drive.skypark207.com 영향 없음
curl -I https://drive.skypark207.com/         # 200 (변화 없음)
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| nginx admin.conf 추가가 기존 drive.skypark207.com 라우팅에 회귀 | Medium | High | server.conf 비편집. admin.conf 신규 파일로 분리. Validation (3)·(7) 로 사전·사후 검증 |
| DSM Application Portal 에 admin 서브도메인이 라우팅되지 않아 NAS 외부에서 도달 불가 | Medium | High | Task 8 사전 준비 단계로 명시. merge 전 본인이 DSM 콘솔에서 직접 추가 |
| TLS 인증서가 admin 서브도메인 미발급 (wildcard 미보유 시) | Medium | Medium | NAS DSM 의 Let's Encrypt 발급 절차로 사전 처리. 발급 실패 시 self-signed 로 임시 대체 후 후속 PR |
| GHCR `terab-admin` 패키지가 처음 push 될 때 권한 문제 | Low | Medium | deploy.yml 의 `packages: write` 권한이 build-and-push job 에 이미 있음 (web 도 동일 경로). 첫 push 시 자동 생성 |
| docker-stack.yml `admin:` 블록 들여쓰기/구조 오류 | Medium | Medium | `docker stack config -c docker-stack.yml` 로 사전 검증 |
| services/web 의존성 일부가 사실은 admin 빌드/lint 에 필요한데 누락 | Low | Low | Task 1 의 `npm run build` + `npm run lint` 가 즉시 검출. 누락 시 web 의 package.json 다시 비교해서 단건 추가 |
| Capacitor android 디렉토리를 web 에서 무심코 복제 | Low | Low | Task 1 에 "capacitor 일체 제외" 명시. `services/admin/android/` 가 존재하지 않는지 PR diff 에서 시각 확인 |
| M1 에 healthcheck `curl -f http://localhost:80/` 가 컨테이너 시작 직후 SPA fallback 미준비 시 false negative | Low | Low | web 도 동일 healthcheck 가 작동 중. start_period 10s 미러로 충분 |

## Acceptance

- [ ] Task 1-7 의 각 Validate 명령이 로컬에서 모두 통과
- [ ] PR merge 후 GitHub Actions deploy job 의 "Update admin service" step 이 성공
- [ ] `curl -I https://admin.drive.skypark207.com/` 가 HTTP/2 200 응답 + body 에 `terab admin` 포함
- [ ] `docker service ls` 에서 `terab_admin 1/1` 확인
- [ ] `curl -I https://drive.skypark207.com/` 회귀 없음 (200)
- [ ] services/web 코드 1줄도 수정되지 않음 (PR diff 검증)
- [ ] PRD 의 Delivery Milestones 표 M1 row 가 `Status: done` 으로 갱신 (구현 완료 시점)
- [ ] Plan 의 모든 변경이 worktree `.worktrees/admin-service-bootstrap/` 안에서만 발생 ([CLAUDE.md §"worktree-first 정책"](../../CLAUDE.md))

---

## 후속 plan 안내 (M2/M3 — 본 plan 의 범위 아님)

본 plan 완료 후 PRD 의 M2 (A-01 관리자 로그인), M3 (A-05 사용자 초대 + A-03 사용자 목록) 는 별도 `/ecc:plan` 호출로 진행한다. 각각 신규 plan 파일 예정 명:

- `.claude/plans/admin-login-twofa.plan.md` — D-01 Push 2FA + backup code 재사용, ADMIN role claim 검증
- `.claude/plans/admin-user-invite-list.plan.md` — `services/api/src/admin/` 모듈 신설 (현재 미존재 — PRD risk #1) + `/admin/users/invite` + `/admin/users` 엔드포인트 + A-03/A-05 화면

본 M1 plan 은 그 두 plan 의 부트스트랩 토대가 되며, M2/M3 는 M1 의 빈 디렉토리 (`src/app/`, `src/pages/`, `src/features/`) 에 catalyst UI / hey-api codegen / axios / FSD 슬라이스를 채우는 형태로 진행한다.
