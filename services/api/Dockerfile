# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY .swcrc ./.swcrc
RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache bash

# wait-for-it.sh 설치
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh && chmod +x /usr/local/bin/wait-for-it.sh

# entrypoint 설치
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# 보안: non-root 사용자
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 프로덕션 의존성만 설치 (root 상태에서 실행 후 소유권 이전)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 빌드 결과물 및 마이그레이션 파일 복사
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
