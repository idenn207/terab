# ─── Stage 0: 공통 변수 정의 ──────────────────────────────────────────────
ARG WEB_PATH=services/web
ARG CONTRACTS_PATH=packages/contracts

# ─── Stage 1: Contracts Build ──────────────────────────────────────────────
FROM node:24-alpine AS contracts-builder

ARG CONTRACTS_PATH
WORKDIR /${CONTRACTS_PATH}

COPY ${CONTRACTS_PATH}/package*.json ./
RUN npm ci --ignore-scripts

COPY ${CONTRACTS_PATH}/tsconfig.json ./
COPY ${CONTRACTS_PATH}/src ./src
RUN npm run build

# ─── Stage 2: Web Build ─────────────────────────────────────────────
FROM node:24-alpine AS builder

ARG WEB_PATH
ARG CONTRACTS_PATH
WORKDIR /app

# 의존성 캐시
COPY ${WEB_PATH}/package.json ${WEB_PATH}/package-lock.json ./
RUN npm ci

# 빌드 환경에 Contracts 결과물 미리 배치
COPY --from=contracts-builder /${CONTRACTS_PATH}/dist /${CONTRACTS_PATH}/dist
COPY --from=contracts-builder /${CONTRACTS_PATH}/package.json /${CONTRACTS_PATH}/package.json

# 소스 복사 및 빌드
COPY ${WEB_PATH} .
RUN npm run build

# ─── Stage 3: Runtime (Nginx로 정적 파일 서빙) ───────────────────
FROM node:24-alpine

ARG WEB_PATH

# React 빌드 결과물을 Nginx 기본 경로로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA 라우팅 지원 (새로고침 시 404 방지)
COPY ${WEB_PATH}/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
