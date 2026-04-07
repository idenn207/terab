SHELL := C:/Program Files/Git/usr/bin/bash.exe
.PHONY: infra infra-down infra-reset dev-up dev-down stack-deploy stack-rm stack-update build-web build-android api web android android-open test test-api test-api-unit test-api-integration test-web

LOCAL := docker compose -f docker-compose.local.yml

# ─── 로컬 인프라 (DB + MinIO만) ───────────────────────────────────
infra:
	$(LOCAL) up -d db minio

infra-down:
	$(LOCAL) stop db minio

infra-reset:
	rm -rf ./volumes/ && $(LOCAL) up -d db minio

# ─── 개발 환경 (전체 서비스, 로컬 빌드) ──────────────────────────
dev-up:
	$(LOCAL) up -d

dev-down:
	$(LOCAL) down

# ─── Docker Swarm 운영 환경 ────────────────────────────────────────
stack-deploy:
	docker stack deploy -c docker-stack.yml terab --with-registry-auth

stack-rm:
	docker stack rm terab

stack-update:
	docker service update \
		--image ghcr.io/idenn207/terab-api:latest \
		--with-registry-auth \
		--force \
		terab_api
	docker service update \
		--image ghcr.io/idenn207/terab-web:latest \
		--with-registry-auth \
		--force \
		terab_web

# ─── 빌드 ────────────────────────────────────────────────────────
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
