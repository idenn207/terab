# ─── Stage 1: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 캐시
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# ─── Stage 2: Runtime (Nginx로 정적 파일 서빙) ───────────────────
FROM nginx:alpine

# React 빌드 결과물을 Nginx 기본 경로로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA 라우팅 지원 (새로고침 시 404 방지)
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
