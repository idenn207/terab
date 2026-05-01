# # ─── Stage 1: Contracts Build (결과물 생성) ──────────────────────────────
FROM node:24-alpine AS contracts-builder
WORKDIR /packages/contracts

COPY packages/contracts/package*.json ./
RUN npm ci --ignore-scripts

COPY packages/contracts/tsconfig.json ./
COPY packages/contracts/src ./src
RUN npm run build

# # ─── Stage 2: Web Build ──────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app/services/web

COPY --from=contracts-builder /packages/contracts/dist /app/packages/contracts/dist
COPY --from=contracts-builder /packages/contracts/package.json /app/packages/contracts/package.json
COPY services/web/package*.json services/web/.npmrc ./

RUN npm ci --ignore-scripts
# file: 의존성으로 생성된 dangling symlink를 실제 파일로 대체
RUN rm -rf node_modules/@terab/contract && mkdir -p node_modules/@terab/contract

COPY --from=contracts-builder /packages/contracts/dist ./node_modules/@terab/contract/dist
COPY --from=contracts-builder /packages/contracts/package.json ./node_modules/@terab/contract/package.json

COPY services/web .
RUN npm run build

# # ─── Stage 3: Runtime (Nginx) ──────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/services/web/dist /usr/share/nginx/html
COPY services/web/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80