# ─── Stage 0: 공통 변수 정의 ──────────────────────────────────────────────
FROM node:24-alpine AS base
RUN apk add --no-cache bash

# ─── Stage 1: Contracts Build ──────────────────────────────────────────────
FROM base AS contracts-builder
WORKDIR /packages/contracts

COPY packages/contracts/package*.json ./
RUN npm ci --ignore-scripts

COPY packages/contracts/tsconfig.json ./
COPY packages/contracts/src ./src
RUN npm run build

# ─── Stage 2: Api Build ──────────────────────────────────────────────
FROM base AS builder
WORKDIR /app/services/api

COPY --from=contracts-builder /packages/contracts/dist /app/packages/contracts/dist
COPY --from=contracts-builder /packages/contracts/package.json /app/packages/contracts/package.json
COPY services/api/package*.json ./

RUN npm ci --ignore-scripts
# file: 의존성으로 생성된 dangling symlink를 실제 파일로 대체
RUN rm -rf node_modules/@terab/contract && mkdir -p node_modules/@terab/contract

COPY --from=contracts-builder /packages/contracts/dist ./node_modules/@terab/contract/dist
COPY --from=contracts-builder /packages/contracts/package.json ./node_modules/@terab/contract/package.json

COPY services/api/tsconfig*.json services/api/nest-cli.json services/api/.swcrc ./
COPY services/api/src ./src

RUN npm run build

# ─── Stage 3: Runtime ────────────────────────────────────────────
FROM base AS runner
WORKDIR /app/services/api

# 보안: non-root 사용자
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY services/api/package*.json ./

RUN npm ci --omit=dev --ignore-scripts
# file: 의존성으로 생성된 dangling symlink를 실제 파일로 대체
RUN rm -rf node_modules/@terab/contract && mkdir -p node_modules/@terab/contract

COPY --from=contracts-builder /packages/contracts/dist ./node_modules/@terab/contract/dist
COPY --from=contracts-builder /packages/contracts/package.json ./node_modules/@terab/contract/package.json

# 빌드 결과물 및 마이그레이션 파일 복사
COPY --from=builder /app/services/api/dist ./dist
COPY services/api/drizzle ./drizzle

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
