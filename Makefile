SHELL := C:/Program Files/Git/usr/bin/bash.exe

LOCAL := docker compose -f docker-compose.local.yml --env-file .env.local

# ─── 로컬 인프라 (DB + MinIO만) ───────────────────────────────────
.PHONY: infra
infra:
	$(LOCAL) up -d db minio

.PHONY: infra-down
infra-down:
	$(LOCAL) stop db minio

.PHONY: infra-reset
infra-reset:
	rm -rf ./volumes/ && $(LOCAL) up -d db minio

# ─── 개발 환경 (전체 서비스, 로컬 빌드) ──────────────────────────
.PHONY: dev-up
dev-up:
	$(LOCAL) up -d

.PHONY: dev-down
dev-down:
	$(LOCAL) down

# ─── Docker Swarm 운영 환경 ────────────────────────────────────────
.PHONY: stack-deploy
stack-deploy:
	docker stack deploy -c docker-stack.yml terab --with-registry-auth

.PHONY: stack-rm
stack-rm:
	docker stack rm terab

.PHONY: stack-update
stack-update:
	docker service update \
		--image ghcr.io/idenn207/terab-api:latest \
		--with-registry-auth \
		--force \
		terab_api \
	&& docker service update \
		--image ghcr.io/idenn207/terab-web:latest \
		--with-registry-auth \
		--force \
		terab_web

# ─── 빌드 ────────────────────────────────────────────────────────
.PHONY: build-web
build-web:
	cd services/web && npm run build

.PHONY: build-android
build-android:
	cd services/web && npm run cap:sync

# ─── 백엔드 ────────────────────────────────────────────────────────
.PHONY: api
api:
	cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'

# ─── 프론트엔드 ────────────────────────────────────────────────────
.PHONY: web
web:
	cd services/web && npm run dev

# ─── 안드로이드 ────────────────────────────────────────────────────
.PHONY: android
android:
	cd services/web && npm run cap:android

.PHONY: android-open
android-open:
	cd services/web && npm cap open android

# ─── 테스트 ────────────────────────────────────────────────────────
.PHONY: test
test: test-api test-web

.PHONY: test-api
test-api:
	cd services/api && ./gradlew check

.PHONY: test-api-unit
test-api-unit:
	cd services/api && ./gradlew test

.PHONY: test-api-integration
test-api-integration:
	cd services/api && ./gradlew integrationTest

.PHONY: test-web
test-web:
	cd services/web && npm test
