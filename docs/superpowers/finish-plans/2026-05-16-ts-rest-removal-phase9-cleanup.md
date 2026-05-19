# Phase 9 — Cleanup (packages/contracts 삭제 + 인프라/CLAUDE.md 박제) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. 본 Phase는 주로 삭제·단순화 작업.

**Goal:** 모든 도메인 전환이 완료되어 ts-rest/Zod 사용처가 0개인 상태에서 `packages/contracts` 패키지 자체를 제거하고, Dockerfile·CI·Makefile을 단순화하며, spec 섹션 6의 패턴 규칙을 `services/api/CLAUDE.md`/`services/web/CLAUDE.md`에 박제한다.

**Architecture:** 본 Phase는 모든 변경이 "삭제 또는 단순화". 새 패턴은 Phase 0~8에서 이미 동작 중이므로 cleanup은 기능 영향 0. 단, Dockerfile/deploy.yml 변경은 빌드 시스템 영향이 크므로 마지막 검증 단계가 가장 중요.

**Tech Stack:** Phase 0/1과 동일. 본 Phase에서 추가 의존성 없음.

**Commit 단위:** 1 commit (`chore: Phase 9 — packages/contracts 제거 + 인프라/문서 정리`).

**Spec 참조:** §1 (제거되는 인프라 자산), §4.5, §6.C (CLAUDE.md 박제 시점).

**전제:** Phase 0~8 완료. 모든 도메인이 새 패턴으로 동작. `make build-api && make build-web` 통과. `npm --prefix services/api test`, `npm --prefix services/web test` 통과.

---

## File Structure

### Delete
- `packages/contracts/` 디렉토리 전체

### Modify
- `services/api/package.json` — ts-rest/Zod/@terab/contract 의존성 제거
- `services/web/package.json` — 동일
- `services/api/Dockerfile` — contracts-builder stage 삭제, path 단순화
- `services/web/Dockerfile` — 동일
- `.github/workflows/deploy.yml` — contracts 관련 step/cache 삭제, matrix context 변경
- `Makefile` — build-packages target 삭제
- `CLAUDE.md` (루트) — packages/contracts 줄 삭제
- `services/api/CLAUDE.md` — ts-rest 컨벤션 삭제 → swagger 컨벤션으로 재작성 (spec §6.A 박제), DTO 검증·UUID/ENUM 표현 컨벤션 포함
- `services/web/CLAUDE.md` — ts-rest 컨벤션 삭제 → hey-api/TanStack 컨벤션 재작성 (spec §6.B 박제)
- `services/api/src/**/dto/*.dto.ts` (request DTO) — class-validator/class-transformer 누락분 보강 (@IsUUID, @IsEnum, @IsBoolean, @IsInt 등), validator로 표현되는 항목의 중복 `@ApiProperty` 제거
- `services/api/src/**/dto/*.dto.ts` (response DTO) — UUID/ENUM 명시 패턴 정리 (`@ApiProperty({ type: String, format: 'uuid' })` / `@ApiProperty({ enum: [...] })` 일관 적용)
- `packages/contracts/CLAUDE.md` — 패키지 디렉토리와 함께 삭제됨

---

## Task 1: 사용처 0 검증 (안전망)

본 Phase 진입 전 ts-rest/Zod/@terab/contract 사용처가 정말 0개인지 확인.

- [ ] **Step 1: ts-rest 사용처 검색**

Run: `grep -rn "@ts-rest\|tsRestHandler\|TsRestHandler\|initContract\|initTsrReactQuery" services/api/src services/web/src 2>&1`
Expected: 0건. 매치가 있으면 해당 Phase로 돌아가 변환 누락 해결.

- [ ] **Step 2: @terab/contract 사용처 검색**

Run: `grep -rn "@terab/contract" services/api/src services/web/src 2>&1`
Expected: 0건.

- [ ] **Step 3: zod 사용처 검색**

Run: `grep -rn "from 'zod'\|from \"zod\"" services/api/src services/web/src 2>&1`
Expected: 0건. 매치가 있으면 해당 위치에서 zod 제거 + class-validator 또는 plain 검증으로 교체.

- [ ] **Step 4: import { contract } 검색**

Run: `grep -rn "import.*{[^}]*contract[^}]*}.*@terab/contract\|import.*contract.*from" services/api/src services/web/src 2>&1`
Expected: 0건.

**위 4 검증이 모두 0건이 아닌 경우 Phase 9 중단 → 해당 Phase로 돌아가 해결**.

---

## Task 2: package.json에서 의존성 제거

**Files:**
- Modify: `services/api/package.json`
- Modify: `services/web/package.json`

- [ ] **Step 1: API 의존성 제거**

```bash
npm --prefix services/api uninstall @terab/contract @ts-rest/core @ts-rest/nest zod
```

또는 package.json 수동 편집 후 `npm install`.

기대 변경 (`services/api/package.json`):
```diff
"dependencies": {
-  "@terab/contract": "file:../../packages/contracts",
-  "@ts-rest/core": "^3.52.1",
-  "@ts-rest/nest": "^3.52.1",
   ...
-  "zod": "3.22.x"
}
```

- [ ] **Step 2: Web 의존성 제거**

```bash
npm --prefix services/web uninstall @terab/contract @ts-rest/core @ts-rest/react-query zod
```

기대 변경 (`services/web/package.json`):
```diff
"dependencies": {
-  "@terab/contract": "file:../../packages/contracts",
-  "@ts-rest/core": "^3.52.1",
-  "@ts-rest/react-query": "^3.52.1",
   ...
-  "zod": "3.22.x"
}
```

- [ ] **Step 3: vite.config.ts의 optimizeDeps 갱신**

`services/web/vite.config.ts`의 `optimizeDeps.include` 배열에서 `'@terab/contract'` 제거:

```diff
optimizeDeps: {
-  include: ['@terab/contract'],
+  // include: [],   // 빈 배열은 생략 가능
},
```

- [ ] **Step 4: 빌드 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공 — ts-rest 사용처가 정말 0개임을 마지막으로 검증.

Run: `npm --prefix services/web run build`
Expected: 빌드 성공.

- [ ] **Step 5: 테스트 검증**

Run: `npm --prefix services/api test`
Run: `npm --prefix services/web test`
Expected: 모두 통과.

---

## Task 3: packages/contracts 디렉토리 삭제

**Files:**
- Delete: `packages/contracts/` 전체

- [ ] **Step 1: 디렉토리 삭제**

```bash
git rm -r packages/contracts
```

- [ ] **Step 2: packages/ 디렉토리에 다른 패키지가 있는지 확인**

Run: `ls packages/ 2>&1`
Expected: 비어 있으면 `packages/` 디렉토리 자체도 삭제 가능. 다른 패키지가 있으면 그대로 유지.

```bash
# packages 비어 있으면:
rmdir packages
```

- [ ] **Step 3: 빌드 재검증**

Run: `npm --prefix services/api run build && cd ../web && npm run build`
Expected: 모두 빌드 성공.

---

## Task 4: services/api/Dockerfile 재작성

**Files:**
- Modify: `services/api/Dockerfile`

기존 Dockerfile은 repo root 컨텍스트(`docker build -f services/api/Dockerfile .`)를 가정하고 contracts-builder 스테이지 + dangling symlink 처리를 포함. **각 서비스 디렉토리가 root context(`docker build ./services/api`)가 되도록 단순화**.

- [ ] **Step 1: 기존 Dockerfile 백업 확인**

Run: `git log --oneline -1 services/api/Dockerfile`
Expected: 최근 commit 표시 (롤백 reference).

- [ ] **Step 2: 재작성**

```dockerfile
# services/api/Dockerfile
# Build context: ./services/api (변경된 컨텍스트, 더 이상 repo root 아님)

# ─── Stage 0: 공통 변수 정의 ──────────────────────────────────────────────
FROM node:24-alpine AS base
RUN apk add --no-cache bash

# ─── Stage 1: Api Build ──────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json .swcrc ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# 보안: non-root 사용자
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# wait-for-it.sh 설치
# 주의: scripts/wait-for-it.sh는 repo root에 있었으나, 컨텍스트 변경 후 services/api 안에 복사 필요
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh && chmod +x /usr/local/bin/wait-for-it.sh

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 빌드 결과물 및 마이그레이션 파일 복사
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**변경 핵심:**
- `contracts-builder` 스테이지 전체 삭제
- `WORKDIR /app/services/api` → `WORKDIR /app`
- `COPY services/api/...` 모두 `COPY ./` 또는 파일명 prefix 제거
- dangling symlink 처리 (`rm -rf node_modules/@terab/contract` + `COPY --from=contracts-builder`) 전부 삭제
- `wait-for-it.sh`가 repo root의 `scripts/`에 있었음 → 컨텍스트 변경 시 `services/api`로 복사 필요 (Task 4 Step 3 참조)

- [ ] **Step 3: wait-for-it.sh 처리**

Run: `ls scripts/wait-for-it.sh services/api/wait-for-it.sh 2>&1`

옵션 A (간단): `scripts/wait-for-it.sh` → `services/api/wait-for-it.sh` 복사
```bash
cp scripts/wait-for-it.sh services/api/wait-for-it.sh
# scripts/wait-for-it.sh는 mq에서도 쓰일 수 있으므로 삭제 안 함
```

옵션 B (공유 자산 유지): repo root 컨텍스트 유지 + `services/api/Dockerfile`에서 `COPY scripts/wait-for-it.sh ...`로 두기. 이 경우 deploy.yml과 Makefile도 컨텍스트 변경 안 함.

**결정**: 옵션 A 채택 (Phase 9 cleanup의 본질은 컨텍스트 단순화). wait-for-it.sh는 서비스마다 사본을 두는 게 인프라 단순성 면에서 유리. mq도 마찬가지로 처리하지만 본 Phase는 api/web만 다룸 — mq는 이미 `./services/mq` 컨텍스트라 영향 없음.

scripts/wait-for-it.sh는 그대로 유지 (다른 곳에서 사용 가능성).

`services/api/wait-for-it.sh`는 LF EOL로 저장 (linux 환경에서 실행되는 shell script). CLAUDE.md L141의 LF 예외 규칙 적용:
```bash
# CRLF로 잘못 저장되었다면:
dos2unix services/api/wait-for-it.sh
# 또는 PowerShell:
$c = Get-Content -Raw services/api/wait-for-it.sh; $new = $c -replace "\r\n", "`n"; [System.IO.File]::WriteAllText((Resolve-Path services/api/wait-for-it.sh), $new)
```

---

## Task 5: services/web/Dockerfile 재작성

**Files:**
- Modify: `services/web/Dockerfile`

- [ ] **Step 1: 재작성**

```dockerfile
# services/web/Dockerfile
# Build context: ./services/web

# ─── Stage 1: Web Build ──────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ─── Stage 2: Runtime (Nginx) ──────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**변경 핵심:**
- `contracts-builder` 스테이지 삭제
- `WORKDIR /app/services/web` → `WORKDIR /app`
- `COPY services/web/...` 모두 `COPY ./` 또는 파일명 prefix 제거
- dangling symlink 처리 삭제

> `COPY . .` 단계에서 `node_modules`/`dist` 포함되지 않도록 `.dockerignore` 확인:

Run: `cat services/web/.dockerignore 2>&1 || echo NOT_FOUND`
없으면 생성:
```
node_modules
dist
.git
```

---

## Task 6: .github/workflows/deploy.yml 갱신

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: test-api job에서 contracts 관련 step 삭제**

기존 `test-api`의 다음 라인 삭제:
```yaml
- name: Set up Node 24 (contracts)
  uses: actions/setup-node@v6
  with:
    node-version: 24
    cache: npm
    cache-dependency-path: packages/contracts/package-lock.json

# contract
- name: Build contracts
  working-directory: packages/contracts
  run: |
    npm ci
    npm run build
```

`test-api` 후의 잔존 step:
```yaml
test-api:
  name: Test (api)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Set up Node 24 (api)
      uses: actions/setup-node@v6
      with:
        node-version: 24
        cache: npm
        cache-dependency-path: services/api/package-lock.json
    # api
    - name: Api build & type check
      working-directory: services/api
      run: |
        npm ci
        npm run build
    - name: Api tests
      working-directory: services/api
      run: npm test
```

- [ ] **Step 2: test-web job에서 contracts 관련 step 삭제**

`test-web`도 동일 패턴으로 contracts 관련 setup-node + Build contracts step 삭제.

- [ ] **Step 3: build-and-push matrix 변경**

기존:
```yaml
matrix:
  include:
    - service: api
      context: .
      file: services/api/Dockerfile
    - service: mq
      context: ./services/mq
    - service: web
      context: .
      file: services/web/Dockerfile
```

변경 (각 서비스 디렉토리가 컨텍스트, file 옵션 제거):
```yaml
matrix:
  include:
    - service: api
      context: ./services/api
    - service: mq
      context: ./services/mq
    - service: web
      context: ./services/web
```

`build-push-action` step의 `file` 옵션도 제거:
```diff
- name: Build and push
  uses: docker/build-push-action@v6
  with:
    context: ${{ matrix.context }}
-   file: ${{ matrix.file }}
    push: true
    ...
```

- [ ] **Step 4: EOL 확인 (deploy.yml은 GitHub Actions runner에서 실행되므로 LF 권장)**

`.github/workflows/deploy.yml`은 CLAUDE.md L141의 LF 예외 규칙 대상. LF로 저장 검증:

Run: `(Get-Content -Raw .github/workflows/deploy.yml) -match "`r`n"`
Expected: 결과에 따라 — `.gitattributes`가 강제하면 그에 따름. False면 LF, True면 CRLF (CLAUDE.md L144는 .gitattributes 우선).

`.gitattributes` 확인:
Run: `cat .gitattributes 2>&1 | head -20`

`.github/workflows/*.yml`이 LF 강제 설정되어 있는지 확인 후, 충돌 시 .gitattributes 따름.

---

## Task 7: Makefile 갱신

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: `build-packages` target 삭제**

기존:
```makefile
.PHONY: build-packages
build-packages:
	cd packages/contracts && npm run build
```

→ 전체 삭제.

- [ ] **Step 2: `build` target의 의존 제거**

기존:
```makefile
.PHONY: build
build: build-packages build-api build-mq build-web build-android
```

변경:
```makefile
.PHONY: build
build: build-api build-mq build-web build-android
```

- [ ] **Step 3: `build-api`, `build-web` target의 의존 제거**

기존:
```makefile
.PHONY: build-api
build-api: build-packages
	npm --prefix services/api run build

.PHONY: build-web
build-web: build-packages
	npm --prefix services/web run build
```

변경:
```makefile
.PHONY: build-api
build-api:
	npm --prefix services/api run build

.PHONY: build-web
build-web:
	npm --prefix services/web run build
```

- [ ] **Step 4: `image` target에서 `-f services/api/Dockerfile .` 패턴 변경**

기존:
```makefile
.PHONY: image
image: build
	docker build -t terab-api:local -f services/api/Dockerfile .
	docker build -t terab-mq:local ./services/mq
	docker build -t terab-web:local -f services/web/Dockerfile .
```

변경 (각 서비스 컨텍스트):
```makefile
.PHONY: image
image: build
	docker build -t terab-api:local ./services/api
	docker build -t terab-mq:local ./services/mq
	docker build -t terab-web:local ./services/web
```

- [ ] **Step 5: 검증**

Run: `make build-api`
Expected: API 빌드 성공.

Run: `make build-web`
Expected: Web 빌드 성공.

(`make image`는 docker daemon 필요 — 로컬 docker 환경 있으면 검증, 없으면 CI에서 검증)

---

## Task 8: CLAUDE.md 정리 (루트)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: `packages/contracts/` 줄 삭제**

기존 (L55):
```
packages/
  contracts/    # API·Web 공유 계약 (ts-rest + Zod) — 세부 컨벤션은 packages/contracts/CLAUDE.md 참조
services/
```

변경:
```
packages/     # (현재 비어 있음)
services/
```

또는 `packages/`도 삭제했다면:
```
services/
  api/          # NestJS 11 (REST API) — 세부 컨벤션은 services/api/CLAUDE.md 참조
  ...
```

- [ ] **Step 2: 다른 ts-rest/Zod 참조 검색**

Run: `grep -n "ts-rest\|@terab/contract\|packages/contracts" CLAUDE.md`
Expected: 0건 (Step 1 외).

추가 매치 있으면 삭제 또는 갱신.

---

## Task 9: services/api/CLAUDE.md 박제 — spec §6.A 반영

**Files:**
- Modify: `services/api/CLAUDE.md`

services/api/CLAUDE.md의 ts-rest 컨벤션 부분을 spec §6.A의 swagger 작성 규칙으로 교체.

- [ ] **Step 1: 기존 ts-rest 관련 섹션 검색**

Run: `grep -n "ts-rest\|TsRestHandler\|tsRestHandler\|contract" services/api/CLAUDE.md`
Expected: 다수 매치 (도메인 모듈 의존 그래프, Docker 빌드 contracts-builder 설명 등).

- [ ] **Step 2: Docker 빌드 섹션 갱신**

기존 (services/api/CLAUDE.md L121~131):
```markdown
### Docker 빌드

`services/api/Dockerfile`을 루트 컨텍스트에서 빌드한다 (`docker build -f services/api/Dockerfile .`).

| Stage | 역할 |
|---|---|
| `contracts-builder` | `packages/contracts` 빌드 (ts-rest 계약 컴파일) |
| `builder` | API 소스 빌드 (`nest build`) |
| `runner` | 런타임 이미지 (non-root `appuser`, prod deps만 설치) |

**`@terab/contract` 심링크 문제**: `file:` 경로 의존성은 `npm ci` 후 `node_modules/@terab/contract`가 dangling symlink가 된다. Dockerfile에서 해당 디렉토리를 수동으로 제거하고 contracts-builder의 산출물로 교체하는 처리가 포함되어 있다. 이 처리를 수정하거나 제거하지 않는다.

\`\`\`bash
# 로컬 Docker 이미지 빌드 (루트에서 실행)
make build-local
\`\`\`
```

변경:
```markdown
### Docker 빌드

`services/api/Dockerfile`을 각 서비스 디렉토리 컨텍스트에서 빌드한다 (`docker build ./services/api`).

| Stage | 역할 |
|---|---|
| `builder` | API 소스 빌드 (`nest build`) |
| `runner` | 런타임 이미지 (non-root `appuser`, prod deps만 설치) |

\`\`\`bash
# 로컬 Docker 이미지 빌드 (루트에서 실행)
make image
\`\`\`
```

- [ ] **Step 3: spec §6.A 패턴/규칙을 새 섹션으로 추가**

services/api/CLAUDE.md의 적절한 위치(예: "Claude 행동 지침" 직전 또는 "주요 명령어" 다음)에 다음 섹션 추가:

```markdown
## Swagger / DTO 컨벤션

> 본 컨벤션은 ts-rest 제거 마이그레이션(2026-05-16) 완료 시점에 박제됨. 원본은 `docs/superpowers/finish-specs/2026-05-16-ts-rest-removal-swagger-migration-design.md` §6.A.

### Controller 데코레이터

- 경로 prefix: `@Controller('domain')` — kebab/단수형 (`'auth'`, `'file'`, `'trusted-device'`)
- 그룹 태그: `@ApiTags('Domain')` — PascalCase 단수형
- 인증 기본값: 글로벌 security로 처리. `@Public()` 라우트는 자동 비움 (데코레이터가 `ApiSecurity({})` 합성)

### 메서드 데코레이터 순서 (고정)

\`\`\`
@Public() / @RequirePermission()
@Throttle(...)
@Post/@Get/@Patch/@Delete
@HttpCode(...)
@ApiOperation({ summary: '한글 요약' })
@ApiExtraModels(...)
@ApiResponse({ status, type/schema })
@ApiError('KEY1', 'KEY2')
\`\`\`

순서 위반 시 PR review reject.

### HttpCode 명시

| 메서드 | 기본 | 명시 필수 |
|---|---|---|
| GET | 200 | 거의 없음 |
| POST | 201 | **200 응답 시 `@HttpCode(HttpStatus.OK)` 필수** |
| DELETE | 200 | **204 응답 시 `@HttpCode(HttpStatus.NO_CONTENT)` 필수** |

### 응답 표현 패턴

\`\`\`ts
// 단일
@ApiResponse({ status: HttpStatus.OK, type: UserDto })
// 배열
@ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
// 빈 응답
@ApiResponse({ status: HttpStatus.NO_CONTENT })
// Discriminated union — @ApiExtraModels + oneOf + discriminator.mapping 3종 세트 필수
\`\`\`

union 응답은 3종 세트 누락 시 web codegen narrowing이 깨진다.

### DTO 작성

- 위치: `src/{domain}/dto/`, 공유는 `src/common/dto/`
- 파일명 kebab-case + `.dto.ts`, 클래스명 PascalCase + `Dto`
- 필드 `!: type` (non-null assertion)
- 단순 필드는 swagger plugin(`nest-cli.json`의 `"plugins": ["@nestjs/swagger"]`)이 자동 처리. 명시 메타만 `@ApiProperty(...)` 수동
- Response DTO에는 class-validator 데코레이터 불필요. 민감 필드 `@Exclude()`

### Request DTO 검증 원칙 (필수)

> REST API 입력 검증의 게이트. 모든 request body / query / path는 ValidationPipe(글로벌) + class-validator + class-transformer로 검증된다. validator가 누락된 필드는 **검증 게이트가 무력화**된다 — 보안·계약 양쪽에서 중대 결함.

- 모든 request DTO 필드에 의미에 맞는 class-validator 데코레이터 부착:
  | 타입 | 필수 validator |
  |---|---|
  | UUID 식별자 | `@IsUUID()` (옵션: `'4'`) |
  | string literal union (`'a' \| 'b'`) | `@IsEnum([...])` 또는 `@IsIn([...])` |
  | enum 값 | `@IsEnum(MyEnum)` |
  | 자연어 텍스트 | `@IsString()` + `@MinLength`/`@MaxLength` |
  | 정수 | `@IsInt()` + `@Min`/`@Max` |
  | boolean | `@IsBoolean()` |
  | 이메일 | `@IsEmail()` |
  | URL | `@IsUrl()` |
  | optional | 위 데코레이터들 위에 `@IsOptional()` 추가 |
  | 중첩 객체 | `@ValidateNested()` + `@Type(() => SubDto)` |
  | 배열 | 항목 validator + `each: true` |
- **swagger plugin의 자동 합성**: `classValidatorShim: true` (기본값)이므로 validator의 메타데이터가 OpenAPI에 자동 반영된다. 따라서:
  - validator로 표현되는 항목(`enum`, `format: 'uuid'`, `minLength`/`maxLength`, `minimum`/`maximum`)은 `@ApiProperty(...)` 옵션에서 **중복 작성 금지**
  - `@ApiProperty()`는 다음 경우에만 명시: description, example, deprecated, `additionalProperties`, 복잡 타입(`Record`, `oneOf`), 타입 추론이 불충분한 경우(예: `type: 'integer'`)
- transform이 필요한 필드(`@Type(() => Number)` 등)는 class-transformer 데코레이터 명시. 글로벌 ValidationPipe는 `transform: true` 전제

### Response DTO의 UUID / ENUM 표현 (composed decorator 미도입)

> response DTO는 validator를 부착하지 않으므로 plugin이 추출할 메타데이터가 없다. UUID/ENUM 표현을 위해 composed decorator(`@ApiUuidProperty` 등)를 도입하지 않고 **`@ApiProperty` 명시 패턴을 그대로 유지한다** — 추상화 한 겹보다 명시 한 줄이 코드 grep·OpenAPI 추적·신규 기여자 이해도에 유리하다는 판단.

- UUID 필드: `@ApiProperty({ format: 'uuid' })`
- nullable UUID (`string | null`): `@ApiProperty({ type: String, format: 'uuid', nullable: true })`
  - `type: String` 명시 필수 — 명시 없이 `format`만 주면 plugin의 union 타입 추론이 `Object`로 fallback되어 OpenAPI에 `type: "object"` 회귀가 발생함
- string literal union: `@ApiProperty({ enum: ['VALUE_A', 'VALUE_B'] })`
- nullable enum: `@ApiProperty({ enum: [...], nullable: true })`
- `Date` 필드: 명시 불필요. plugin이 자동으로 `string / date-time`으로 직렬화

### Path/Query 검증

\`\`\`ts
@Param('id', ParseUUIDPipe) id: string
@Query() query: XxxQueryDto
\`\`\`

- path UUID 파라미터는 `ParseUUIDPipe` 또는 query DTO 내 `@IsUUID()` 중 하나로 반드시 검증
- query DTO도 request DTO와 동일한 검증 원칙 적용 (`@IsOptional` + `@Type(() => Number)` 패턴 활용)

### `@ApiError` 헬퍼

- `@ApiError('KEY1', 'KEY2')`만 사용 — ErrorCode 키 기반
- 직접 `@ApiResponse({ status: 4xx, type: ErrorResponseDto })` 작성 **금지** (보일러플레이트 + ErrorCode와 drift)

### `@Public()` 사용

- 가드 우회 + OpenAPI security 비움이 자동 합성
- 부착 시 web `PUBLIC_PATHS` 자동 갱신됨

### OpenAPI 노출

- dev 환경에서만: `SwaggerModule.setup('swagger', app, doc, { jsonDocumentUrl: '/json' })`
- prod 환경은 `NODE_ENV === 'dev'` 분기 안에서만 활성화

### 금지 패턴

| 금지 | 대체 |
|---|---|
| `@ApiProperty()` 단순 필드 명시적 부착 | swagger plugin에 위임 |
| `@Post()` 후 `@HttpCode` 생략 (200 의도) | `@HttpCode(HttpStatus.OK)` 명시 |
| `@ApiResponse({ status: 4xx, type: ErrorResponseDto })` 직접 | `@ApiError('KEY')` |
| `oneOf` 없이 union 응답 type 명시 | `@ApiExtraModels + oneOf + discriminator.mapping` 3종 세트 |
| `class-validator` 없는 DTO body 검증 | ValidationPipe + class-validator |
| request DTO에 `@IsUUID`/`@IsEnum` 누락 | 모든 식별자/literal union에 validator 필수 — 검증 게이트 무력화 방지 |
| validator로 표현 가능한 메타를 `@ApiProperty`에 중복 작성 (`enum`, `format: 'uuid'`, `min`/`max`, `minLength`/`maxLength`) | validator만 부착, plugin이 자동 합성 |
| response DTO에 `string \| null` UUID인데 `type: String` 누락 | `@ApiProperty({ type: String, format: 'uuid', nullable: true })` — 미명시 시 OpenAPI `type: "object"` 회귀 |
| response DTO에 UUID 표현용 composed decorator (`@ApiUuidProperty` 등) 도입 | `@ApiProperty({ format: 'uuid' })` 명시 패턴 유지 — 추상화 1겹보다 명시가 grep·OpenAPI 추적·이해도에 유리 |
```

- [ ] **Step 4: 모듈 의존 그래프의 contract 언급 삭제**

기존 (L100 근처) `### 내부 패키지 (@terab/*)` 표에서 `@terab/contract` 행 삭제.

- [ ] **Step 5: EOL 확인 (CRLF)**

Run: `(Get-Content -Raw services/api/CLAUDE.md) -match "`r`n"`
Expected: True.

---

## Task 10: services/web/CLAUDE.md 박제 — spec §6.B 반영

**Files:**
- Modify: `services/web/CLAUDE.md`

- [ ] **Step 1: 기존 ts-rest 관련 부분 검색**

Run: `grep -n "ts-rest\|initTsrReactQuery\|@terab/contract" services/web/CLAUDE.md`

매치 위치에서 제거 또는 갱신.

- [ ] **Step 2: spec §6.B 패턴/규칙을 새 섹션으로 추가**

기존 "API 레이어 컨벤션" 섹션(services/web/CLAUDE.md L279~289) 갱신:

```markdown
## API 레이어 / TanStack Query × Zustand 컨벤션

> 본 컨벤션은 ts-rest 제거 마이그레이션(2026-05-16) 완료 시점에 박제됨. 원본은 `docs/superpowers/finish-specs/2026-05-16-ts-rest-removal-swagger-migration-design.md` §6.B.

### Transport / codegen

- 단일 `axiosInstance` (`shared/api/axiosInstance.ts`) + request interceptor 내부에서 `isPublicPath(url)` 기반 Authorization 헤더 분기
- 401 응답 시 refresh queue (기존 동작 유지)
- codegen 산출물은 `shared/api/generated/` (git tracked)
- import는 `@shared/api` 단일 진입점 — `@/shared/api/generated/...` 직접 경로 금지

### codegen 워크플로우

1. API DTO/엔드포인트 변경
2. API dev 서버 reload (켜져 있어야 함)
3. `npm --prefix services/web run openapi:codegen`
4. generated diff 검토 + 사용처 갱신
5. 동시에 commit (generated + 사용처 분리 금지)

### 상태 분류

| 데이터 | 저장소 |
|---|---|
| 서버 응답 객체(user, files 등) | TanStack Query 캐시 |
| 클라이언트 세션(accessToken) | Zustand |
| UI 토글/모달 | useState / features Zustand |
| 폼 임시값 | React Hook Form |

**원칙**: 서버 데이터를 Zustand에 복제 금지. user 표시는 `useMeQuery()`로 가져온 캐시 사용.

### `api/` 세그먼트 — 항상 생성

- codegen 함수를 호출하는 슬라이스는 **정책 유무 무관 `api/` 필수**
- 파일 분리: GET → `query.ts`, mutation → `mutation.ts`
- 단순 wrapper도 작성:
  \`\`\`ts
  export function useLoginMutation() {
    return useMutation({ ...loginMutation() });
  }
  \`\`\`
- model은 항상 `../api/...`만 import (codegen 함수 직접 import 금지, 타입 import는 허용)
- `api/`는 슬라이스 `index.ts`에서 export 안 함 (외부에는 model/ui만)

### 호출 패턴

\`\`\`ts
// mutation
const { mutate, isPending } = useXxxMutation();
mutate({ body, path, query }, { onSuccess: ({ data }) => { ... } });

// query
const { data, isLoading } = useXxxQuery();
\`\`\`

응답 구조: `{ data, error, response }` (hey-api 형식).

### Zustand 액션 호출

\`\`\`ts
// model/useXxx.ts의 onSuccess 콜백에서만
useUserStore.getState().setAuth(token, user);   // ✅ getState() — 콜백에서는 구독 불필요
\`\`\`

콜백 안에서 hook 호출 금지 (rules of hooks 위반).

### Query Invalidation

- 도메인 공통 invalidation은 `api/mutation.ts` wrapper에서 처리:
  \`\`\`ts
  const queryClient = useQueryClient();
  return useMutation({
    ...uploadCompleteMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [{ _id: 'getFiles' }] }),
  });
  \`\`\`
- queryKey는 hey-api 자동 생성 키만 사용 (수동 작성 금지)

### react-hook-form

- DTO 타입을 `useForm<XxxDto>()` 제네릭 사용
- 검증은 `register()` 내장 옵션(`required`/`minLength`/`pattern`)
- `zodResolver` 금지

### 금지 패턴

| 금지 | 대체 |
|---|---|
| model에서 `@shared/api`의 codegen 함수 직접 import | `api/` wrapper 경유 |
| 서버 데이터 Zustand 복제 | TanStack Query 캐시 |
| `useUserStore()` 전체 구독 | selector |
| `useUserStore.setState()` 직접 호출 | `getState().action()` |
| `useForm` 제네릭 생략 | `useForm<XxxDto>()` |
| queryKey 수동 작성 | hey-api 자동 키 |
| codegen 산출물 직접 경로 import | `@shared/api` 통일 |
| `axiosBasic`/`axiosAuth` 같은 인스턴스 분리 | 단일 `axiosInstance` + 인터셉터 분기 |
```

- [ ] **Step 3: 기존 axios 인스턴스 설명 단순화**

`shared/api/axiosInstance.ts`가 단일 인스턴스이므로 `axiosBasic`/`axiosAuth` 분리 설명 삭제. 다음 형태로 갱신:

```markdown
- axios 인스턴스: `shared/api/axiosInstance.ts` — 단일 인스턴스. 이 외 경로에 생성 금지
- `axiosInstance`는 request 시 PUBLIC 경로가 아니면 Authorization 헤더 부착, 401 응답 시 refresh queue 처리 후 검증 실패 시 `/login`으로 리다이렉트한다
- PUBLIC 경로 판단은 `isPublicPath(url)` 사용 (codegen 자동 생성, `@Public()` 데코레이터가 단일 소스)
```

- [ ] **Step 4: EOL CRLF 확인**

Run: `(Get-Content -Raw services/web/CLAUDE.md) -match "`r`n"`
Expected: True.

---

## Task 11: design doc + plan을 finish 디렉토리로 이동

**Files:**
- Move: `docs/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md` → `docs/superpowers/finish-specs/`
- Move: `docs/superpowers/plans/2026-05-16-ts-rest-removal-*.md` → `docs/superpowers/finish-plans/`

기존 finish-specs/finish-plans 패턴 그대로 따름 (recent commit `docs: 완료된 계획 finish로 이동` 참조).

- [ ] **Step 1: spec 이동**

```bash
git mv docs/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md \
       docs/superpowers/finish-specs/2026-05-16-ts-rest-removal-swagger-migration-design.md
```

- [ ] **Step 2: plan 일괄 이동**

```bash
git mv docs/superpowers/plans/2026-05-16-ts-rest-removal-README.md \
       docs/superpowers/finish-plans/2026-05-16-ts-rest-removal-README.md
git mv docs/superpowers/plans/2026-05-16-ts-rest-removal-phase0-infra.md \
       docs/superpowers/finish-plans/2026-05-16-ts-rest-removal-phase0-infra.md
# ... 동일 패턴으로 Phase 1~9 plan 모두 이동
```

- [ ] **Step 3: 빈 디렉토리 확인**

Run: `ls docs/superpowers/specs/ docs/superpowers/plans/ 2>&1`

다른 spec/plan이 있으면 그대로 유지. 비어 있으면 그대로 두기 (다음 작업에서 다시 사용).

- [ ] **Step 4: CLAUDE.md(루트)의 spec 참조 경로 갱신**

Phase 9 Task 9/10에서 CLAUDE.md 안에 `docs/superpowers/finish-specs/2026-05-16-...`로 표기되어 있는지 확인. 이미 finish-specs 경로로 작성되어 있으면 변경 불필요.

---

## Task 12: DTO 검증 정합성 보강 (request 검증 + response 표현 일관성)

> 본 Task는 박제(Task 9) 직전 또는 직후에 실행해 컨벤션과 코드를 동기화한다. 단일 commit으로 묶이지만 변경 범위가 크므로 도메인별로 sub-step을 끊어 진행한다.

**Files:**
- Modify: `services/api/src/{auth,twofa,device,trusted-device,folder,file,share,invitation,trash,admin,user, ... }/dto/*.dto.ts`

**원칙:** Task 9 박제 섹션의 "Request DTO 검증 원칙" + "Response DTO의 UUID / ENUM 표현"을 그대로 적용한다. 본 Task는 그 두 단락의 정합성을 코드에 반영하는 mechanical 작업이다.

- [ ] **Step 1: request DTO 스캔 — class-validator 누락 식별**

Run: `grep -rln "extends\|class.*Dto " services/api/src --include="*.dto.ts" 2>&1`
대상 후보: 파일 이름이 `request`/`body`/`query`/`params`/`create`/`update`/`set`/`delete`/`init`/`complete`/`verify`/`approve`/`reject`/`enroll`/`finish`/`login`/`refresh`/`logout` 등으로 끝나는 DTO. (response DTO는 제외)

각 후보 파일에서 다음 패턴이 누락된 곳을 식별:
- UUID 필드 (`id`, `*Id`, `folderId`, `userId`, `challengeId` 등) → `@IsUUID()` 없음
- string literal union (`'option1' | 'option2'`) → `@IsEnum([...])` 또는 `@IsIn([...])` 없음
- enum 필드 → `@IsEnum(Enum)` 없음
- 모든 string → `@IsString()` 없음
- 모든 number → `@IsInt()` 또는 `@IsNumber()` 없음
- 모든 boolean → `@IsBoolean()` 없음
- nullable/optional → `@IsOptional()` 없음
- 배열 → `each: true` 누락
- 중첩 DTO → `@ValidateNested()` + `@Type(() => SubDto)` 누락

- [ ] **Step 2: request DTO에 누락 validator 부착**

식별된 모든 누락 항목 보강. import 추가 (`class-validator`, `class-transformer`).

- [ ] **Step 3: request DTO의 `@ApiProperty` 중복 옵션 제거**

validator로 표현되는 다음 옵션은 `@ApiProperty(...)`에서 삭제 (plugin이 자동 합성):
- `enum: [...]` → `@IsEnum` / `@IsIn`이 표현
- `format: 'uuid'` → `@IsUUID`가 표현
- `minLength`/`maxLength` → `@MinLength`/`@MaxLength`가 표현
- `minimum`/`maximum` → `@Min`/`@Max`가 표현

`@ApiProperty()`가 옵션이 비게 되면 해당 데코레이터 자체를 제거 (plugin이 처리).

남는 `@ApiProperty(...)` 케이스: `description`, `example`, `deprecated`, `type: 'integer'`, 복잡 타입, `additionalProperties` 등.

- [ ] **Step 4: response DTO의 UUID/ENUM 표현 일관성 정리**

response DTO(파일 이름이 `response`/`item`/`info`/`detail`로 끝남 + return type으로 사용되는 DTO)를 순회하며:
- UUID 필드: `@ApiProperty({ format: 'uuid' })` 또는 `@ApiProperty({ type: String, format: 'uuid', nullable: true })` 일관 적용
- string literal union: `@ApiProperty({ enum: ['A', 'B'] })`
- `Date` 필드의 `@ApiProperty({ format: 'date-time' })`는 plugin이 자동 처리하므로 제거 가능 (현 코드베이스는 이미 정리됨, 회귀 방지 확인)
- composed decorator 도입 금지 (Task 9 박제 컨벤션과 일치)

- [ ] **Step 5: 빌드 + 타입 검증**

Run: `npm --prefix services/api run build`
Expected: 성공.

Run: `npm --prefix services/api test`
Expected: 302/302 통과.

- [ ] **Step 6: OpenAPI schema diff 검증**

dev 서버 기동 후 `/json` 캡처, baseline (Phase 9 진입 시점 = Phase 8 종료 ≈ 30775 bytes 부근)과 diff.

기대 변화:
- **추가**: validator 보강에 따른 `minLength`/`maxLength`/`minimum`/`format: 'uuid'`/`enum: [...]` 메타데이터 → schema가 더 엄격해짐
- **유지**: 기존 필드 type/required 동일
- **회귀 없음**: `type: "object"`로 fallback된 UUID 필드 없음, enum이 사라진 필드 없음

회귀 발견 시 즉시 수정 (대부분 response DTO의 `type: String` 누락이 원인).

- [ ] **Step 7: web codegen 재생성 + 사용처 영향 확인**

Run: `npm --prefix services/web run openapi:codegen`
Run: `git diff services/web/src/shared/api/generated/`

기대:
- types.gen.ts에 validator 메타데이터로부터 파생된 좁은 타입(예: literal union, format) 반영
- 사용처 컴파일 오류 0건 (validator 보강은 OpenAPI의 표현을 좁히지 코드 시그니처를 바꾸지 않음)

Run: `npm --prefix services/web run build && npm --prefix services/web test`
Expected: 모두 통과.

---

## Task 13: 최종 검증

본 Phase의 가장 중요한 단계 — 모든 변경이 통합되어 동작하는지.

- [ ] **Step 1: 빌드 전체**

Run: `make build`
Expected: API + MQ + Web + Android 모두 빌드 성공.

- [ ] **Step 2: 테스트 전체**

Run: `make test`
Expected: API + MQ + Web 모두 통과.

- [ ] **Step 3: docker 이미지 빌드 (로컬)**

Run: `make image`
Expected: `terab-api:local`, `terab-mq:local`, `terab-web:local` 이미지 빌드 성공. 각 서비스 디렉토리 컨텍스트로 동작 확인.

- [ ] **Step 4: dev 환경 e2e — 전체 시나리오 수동 검증**

`make api` + `make web` 후 브라우저:

1. **회원가입 흐름** (초대 → register → 메인)
2. **로그인 — AUTHENTICATED 경로** (일반 계정)
3. **로그인 — 2FA 경로** (2FA 활성 계정 → 챌린지 → APPROVED)
4. **로그인 — 백업 코드 경로**
5. **토큰 갱신** (accessToken 만료 시뮬레이션 → axios 인터셉터 refresh → 원 요청 재시도)
6. **로그아웃**
7. **폴더 CRUD** (생성/이름변경/이동/삭제)
8. **파일 업로드** (presigned URL → 멀티파트 → uploadComplete → 목록 등장)
9. **파일 이름변경/이동/복사/삭제**
10. **파일 검색**
11. **파일 다운로드 (단일)**
12. **ZIP 다운로드**
13. **휴지통 목록 / 복원 / 영구 삭제**
14. **신뢰기기 등록 / 목록 / 해제**
15. **디바이스 등록 (푸시 알림) / 목록 / 삭제**
16. **초대장 발급 / 비활성화 / 검증**

각 흐름이 정상 동작 + 응답 구조 변경 정상 반영 + Zustand 액션 정상 호출 + invalidation 적용 확인.

- [ ] **Step 5: prod 모드 dev 환경에서 OpenAPI 미노출 검증**

`NODE_ENV=production`으로 API 기동 시도 (또는 production 빌드 후 실행):
```bash
NODE_ENV=production npm --prefix services/api run start:prod &
sleep 5
curl -i http://localhost:3000/json
# Expected: 404 (NODE_ENV !== 'dev'이므로 SwaggerModule.setup 호출 안 됨)
curl -i http://localhost:3000/swagger
# Expected: 404 동일
kill %1
```

---

## Task 14: Phase 9 commit

```bash
git status   # 변경 사항 확인

git add services/api/package.json services/api/package-lock.json \
        services/web/package.json services/web/package-lock.json \
        services/web/vite.config.ts \
        services/api/Dockerfile services/api/wait-for-it.sh \
        services/web/Dockerfile services/web/.dockerignore \
        .github/workflows/deploy.yml \
        Makefile \
        CLAUDE.md \
        services/api/CLAUDE.md \
        services/web/CLAUDE.md \
        services/api/src \
        services/web/src/shared/api/generated \
        docs/superpowers/finish-specs/2026-05-16-ts-rest-removal-swagger-migration-design.md \
        docs/superpowers/finish-plans/2026-05-16-ts-rest-removal-*.md

# git rm은 자동으로 stage됨
# packages/contracts/ 삭제, docs/specs+plans → finish 이동

git commit -m "chore: Phase 9 — packages/contracts 제거 + DTO 검증 정합성 보강 + 인프라/문서 정리"
```

---

## Phase 9 완료 조건

- [ ] ts-rest/Zod/@terab/contract 사용처 0건 검증
- [ ] services/api/package.json, services/web/package.json 의존성 제거
- [ ] packages/contracts/ 디렉토리 삭제
- [ ] services/api/Dockerfile, services/web/Dockerfile 단순화 (contracts-builder 삭제, path 단순화)
- [ ] .github/workflows/deploy.yml: contracts step 삭제, matrix context 변경
- [ ] Makefile: build-packages 삭제, image target 단순화
- [ ] CLAUDE.md(루트): packages/contracts 줄 삭제
- [ ] services/api/CLAUDE.md: spec §6.A 패턴 박제 + Request 검증 원칙 + Response UUID/ENUM 표현 컨벤션 포함
- [ ] services/web/CLAUDE.md: spec §6.B 패턴 박제
- [ ] request DTO: class-validator/transformer 누락분 보강 (UUID/ENUM/Boolean/Int/Optional/Nested 등) 완료
- [ ] request DTO: validator로 표현되는 메타의 중복 `@ApiProperty` 옵션 제거 완료
- [ ] response DTO: UUID/ENUM 표현 일관성 정리 (`type: String` 누락 회귀 없음), composed decorator 미도입
- [ ] OpenAPI schema diff 검증: validator 메타데이터 추가 외 회귀 없음
- [ ] web codegen 재생성 + 사용처 영향 0건
- [ ] spec + plan → finish 디렉토리로 이동
- [ ] make build / make test / make image 통과
- [ ] dev 환경 e2e 전체 시나리오 정상
- [ ] prod 모드에서 /json /swagger 미노출 확인
- [ ] 1 commit

Phase 9 종료. **마이그레이션 완료**. master로 PR 1회 → 운영 배포 1회.

---

## master 머지 전 최종 체크리스트

PR 본문에 다음 내용 포함:

```markdown
## Summary
ts-rest + Zod 제거, @nestjs/swagger + class-validator (API) + @hey-api/openapi-ts (Web) 마이그레이션 완료.

## Phase 별 commit
- `chore(api): Phase 0 — class-validator/swagger 인프라 + ApiError 헬퍼 추가` (commit hash)
- `chore(web): Phase 0 — @hey-api/openapi-ts codegen + axios 단일 인스턴스 통합` (commit hash)
- `refactor: Phase 1 — invitation 도메인을 표준 NestJS로 전환` (commit hash)
- `refactor: Phase 2 — folder 도메인 전환` (commit hash)
- `refactor: Phase 3 — trusted-device 도메인 전환` (commit hash)
- `refactor: Phase 4 — device 도메인 전환` (commit hash)
- `refactor: Phase 5 — twofa 도메인 전환 (discriminated union 첫 적용)` (commit hash)
- `refactor: Phase 6 — auth 도메인 전환 (LoginResponse oneOf + 쿠키/refresh 흐름 포함)` (commit hash)
- `refactor: Phase 7 — file 도메인 전환 (upload/download 포함)` (commit hash)
- `refactor: Phase 8 — trash 도메인 전환` (commit hash)
- `chore: Phase 9 — packages/contracts 제거 + DTO 검증 정합성 보강 + 인프라/문서 정리` (commit hash)

## 위험 요소·완화책
- hey-api 0.x breaking change → `-E` 옵션 정확 버전 핀, 정기 점검(분기 1회)으로 업그레이드 분리
- 운영 배포: Swarm rolling update 1회 (이번 PR 머지). 롤백 시 이전 master로 git revert + rolling back

## Test plan
- [ ] CI 자동 테스트 (test-api, test-mq, test-web) 통과
- [ ] dev 환경 수동 e2e (16개 시나리오 — Phase 9 Task 12 Step 4 참조) 정상
- [ ] prod 모드 /json /swagger 미노출 확인
- [ ] 운영 NAS 배포 후 spot check (로그인/파일 업로드/다운로드)
```

머지 후:
- 운영 배포 자동 트리거 (deploy.yml)
- Swarm rolling update 1회 발생
- 모니터링: 첫 30분간 로그/메트릭 spot check
