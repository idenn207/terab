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
