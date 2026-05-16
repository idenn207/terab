ifeq ($(OS), Windows_NT)
	SHELL := C:/Program Files/Git/usr/bin/bash.exe
else
	SHELL := /bin/bash
endif

# ─── 환경 설정 ────────────────────────────────────────────────────
.PHONY: setup
setup: ## 로컬/운영 개발 초기 설정 (최초 클론 후 1회, secrets 변경 시 재실행)
	@bash scripts/setup.sh

.PHONY: setup-local
setup-local: ## 로컬 개발 초기 설정 (최초 클론 후 1회, api/mq/web.env 변경 시 재실행)
	@bash scripts/setup-local.sh

# ─── 로컬 인프라 (DB + MinIO + RabbitMQ) ──────────────────────────
.PHONY: infra
infra:
# 	@echo "네트워크 대기 중..."
# 	@until ! docker network inspect terab-infra_terab-net > /dev/null 2>&1; do sleep 1; done
	docker stack deploy -c docker-stack.infra.local.yml terab-infra

.PHONY: infra-down
infra-down:
	docker stack rm terab-infra

.PHONY: infra-reset
infra-reset:
	docker stack rm terab-infra
	@echo "네트워크 제거 대기 중..."
	@until ! docker network inspect terab-infra_terab-net > /dev/null 2>&1; do sleep 1; done
	rm -rf ./volumes/
	docker stack deploy -c docker-stack.infra.local.yml terab-infra

# ─── 개발 환경 (전체 서비스, 로컬 빌드) ──────────────────────────
.PHONY: dev
dev: image infra-down dev-only
	
.PHONY: dev-only
dev-only:
	docker stack deploy -c docker-stack.yml -c docker-stack.local.yml --resolve-image=never terab-dev

.PHONY: dev-down
dev-down: infra-down
	docker stack rm terab-dev

.PHONY: dev-update
dev-update: 
	docker service update \
		--image terab-api:local \
		--with-registry-auth \
		--force \
		terab_api \
	&& docker service update \
		--image terab-mq:local \
		--with-registry-auth \
		--force \
		terab_mq \
	&& docker service update \
		--image terab-web:local \
		--with-registry-auth \
		--force \
		terab_web \

# ─── Docker Swarm 운영 환경 ────────────────────────────────────────
.PHONY: ensure-volumes
ensure-volumes: ## 운영 스택 bind mount 경로 생성 (없을 경우에만)
	@mkdir -p \
		/volume3/docker/terab/volumes/db \
		/volume3/docker/terab/volumes/redis \
		/volume3/docker/terab/services/nginx \
		/volume1/storage
	@chown -R 999:999 \
		/volume3/docker/terab/volumes/db \
		/volume3/docker/terab/volumes/redis

.PHONY: stack
stack:
	@bash scripts/stack-deploy.sh

.PHONY: stack-down
stack-down:
	docker stack rm terab

.PHONY: stack-update
stack-update:
	docker service update \
		--image ghcr.io/idenn207/terab-api:latest \
		--with-registry-auth \
		--force \
		terab_api \
	&& docker service update \
		--image ghcr.io/idenn207/terab-mq:latest \
		--with-registry-auth \
		--force \
		terab_mq \
	&& docker service update \
		--image ghcr.io/idenn207/terab-web:latest \
		--with-registry-auth \
		--force \
		terab_web \

# ─── docker 이미지 빌드 ─────────────────────────────────────────────
.PHONY: image
image: build
	docker build -t terab-api:local -f services/api/Dockerfile .
	docker build -t terab-mq:local ./services/mq
	docker build -t terab-web:local -f services/web/Dockerfile .

# ─── 빌드 ────────────────────────────────────────────────────────
.PHONY: build
build: build-packages build-api build-mq build-web build-android

.PHONY: build-packages
build-packages:
	cd packages/contracts && npm run build

.PHONY: build-api
build-api: build-packages
	cd services/api && npm run build

.PHONY: build-mq
build-mq:
	cd services/mq && npm run build

.PHONY: build-web
build-web: build-packages
	cd services/web && npm run build

.PHONY: build-android
build-android:
	cd services/web && npm run cap:sync

.PHONY: build-android-dev
build-android-dev:
	cd services/web && npm run cap:sync:dev

.PHONY: build-android-prod
build-android-prod:
	cd services/web && npm run cap:sync:prod

# ─── 백엔드 ────────────────────────────────────────────────────────
.PHONY: api
api:
	cd services/api && npm run start:dev

.PHONY: mq
mq:
	cd services/mq && npm run start:dev

# ─── 프론트엔드 ────────────────────────────────────────────────────
.PHONY: web
web:
	cd services/web && npm run dev

# ─── 안드로이드 ────────────────────────────────────────────────────
.PHONY: android
android: build-android
	cd services/web && npm run cap:android

.PHONY: android-dev
android-dev: build-android-dev
	cd services/web && npm run cap:android:dev

.PHONY: android-prod
android-prod: build-android-prod
	cd services/web && npm run cap:android:prod

.PHONY: android-open
android-open:
	cd services/web && npm cap open android

# ─── 테스트 ────────────────────────────────────────────────────────
.PHONY: test
test: test-api test-mq test-web

.PHONY: test-api
test-api:
	cd services/api && npm test

.PHONY: test-mq
test-mq:
	cd services/mq && npm test

.PHONY: test-web
test-web:
	cd services/web && npm test


# ─── Runner ────────────────────────────────────────────────────────
.PHONY: runner
runner:
	docker compose -f docker-compose.runner.yml up

.PHONY: runner-down
runner-down:
	docker compose -f docker-compose.runner.yml down
