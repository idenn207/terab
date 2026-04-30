# ─── Stage 0: 공통 변수 정의 ──────────────────────────────────────────────
ARG API_PATH=services/api
ARG CONTRACTS_PATH=packages/contracts

FROM node:24-alpine AS base
RUN apk add --no-cache bash
WORKDIR /app

# ─── Stage 1: Contracts Build ──────────────────────────────────────────────
FROM base AS contracts-builder

ARG CONTRACTS_PATH
WORKDIR /${CONTRACTS_PATH}

COPY ${CONTRACTS_PATH}/package*.json ./
RUN npm ci --ignore-scripts

COPY ${CONTRACTS_PATH}/tsconfig.json ./
COPY ${CONTRACTS_PATH}/src ./src
RUN npm run build

# ─── Stage 2: Api Build ──────────────────────────────────────────────
FROM base AS builder

ARG API_PATH
ARG CONTRACTS_PATH
WORKDIR /app/${API_PATH}

# file: 로컬 패키지 의존성(contracts)을 먼저 확보 후 의존성 설치
COPY --from=contracts-builder /${CONTRACTS_PATH}/dist /${CONTRACTS_PATH}/dist
COPY --from=contracts-builder /${CONTRACTS_PATH}/package.json /${CONTRACTS_PATH}/package.json
COPY ${API_PATH}/package*.json ./
RUN npm ci --ignore-scripts

COPY ${API_PATH}/tsconfig*.json ${API_PATH}/nest-cli.json ${API_PATH}/.swcrc ./
COPY ${API_PATH}/src ./src

RUN npm run build

# ─── Stage 3: Runtime ────────────────────────────────────────────
FROM base AS runner

ARG API_PATH
ARG CONTRACTS_PATH
WORKDIR /app/${API_PATH}

# # wait-for-it.sh 설치
# COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
# RUN sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh && chmod +x /usr/local/bin/wait-for-it.sh

# # entrypoint 설치
# COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# 보안: non-root 사용자
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# file: 로컬 패키지 의존성(contracts)을 먼저 확보 후 프로덕션 의존성 설치
COPY --from=contracts-builder /${CONTRACTS_PATH}/dist /${CONTRACTS_PATH}/dist
COPY --from=contracts-builder /${CONTRACTS_PATH}/package.json /${CONTRACTS_PATH}/package.json
COPY ${API_PATH}/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 빌드 결과물 및 마이그레이션 파일 복사
COPY --from=builder /app/${API_PATH}/dist ./dist
COPY ${API_PATH}/drizzle ./drizzle

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
