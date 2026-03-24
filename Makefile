SHELL := C:/Program Files/Git/usr/bin/bash.exe
.PHONY: infra infra-down api web test test-api test-web test-api-unit test-api-integration up down

# ─── 운영 환경 (전체 서비스, ghcr.io 이미지) ─────────────────────
up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# ─── 로컬 인프라 (DB + MinIO) ──────────────────────────────────────
infra:
	docker compose -f docker-compose.local.yml up -d

infra-down:
	docker compose -f docker-compose.local.yml down

# ─── 빌드 ────────────────────────────────────────────────────
build-web:
	cd services/web && npm run build

build-android:
	cd services/web && npm run cap:sync

# ─── 백엔드 ────────────────────────────────────────────────────────
api:
	set -a && source .env.local && set +a && cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'

# ─── 프론트엔드 ────────────────────────────────────────────────────
web:
	cd services/web && npm run dev

# ─── 안드로이드 ────────────────────────────────────────────────────
android:
	cd services/web && npm run cap:android

android-open:
	cd services/web && npm cap open android

# ─── 테스트 ────────────────────────────────────────────────────────
test: test-api test-web

test-api:
	cd services/api && ./gradlew check

test-api-unit:
	cd services/api && ./gradlew test

test-api-integration:
	cd services/api && ./gradlew integrationTest

test-web:
	cd services/web && npm test
