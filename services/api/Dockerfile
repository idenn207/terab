# Build context: ./services/api

# ─── Stage 0: 공통 변수 정의 ──────────────────────────────────────────────
FROM node:24-alpine AS base
RUN apk add --no-cache bash

# ─── Stage 1: Api Build ──────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json .swcrc ./
COPY types ./types
COPY src ./src

RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# 보안: non-root 사용자
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# wait-for-it.sh 설치
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
