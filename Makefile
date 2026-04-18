ifeq ($(OS), Windows_NT)
	SHELL := C:/Program Files/Git/usr/bin/bash.exe
else
	SHELL := /bin/bash
endif

# ─── 환경 설정 ────────────────────────────────────────────────────
.PHONY: setup
setup: ## 운영 Docker Config/Secret 등록 (NAS에서 실행, configs.env + secrets.env + secrets/ 필요)
	@bash scripts/setup.sh

.PHONY: setup-local
setup-local: ## 로컬 개발 초기 설정 (최초 클론 후 1회, configs.env/secrets.env 변경 시 재실행)
	@bash scripts/setup-local.sh

# ─── 로컬 인프라 (DB + MinIO + RabbitMQ) ──────────────────────────
.PHONY: infra
infra:
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
dev: infra build-local
	docker stack deploy -c docker-stack.app.local.yml terab

.PHONY: dev-down
dev-down: infra-down
	docker stack rm terab

# ─── Docker Swarm 운영 환경 ────────────────────────────────────────
.PHONY: ensure-volumes
ensure-volumes: ## 운영 스택 bind mount 경로 생성 (없을 경우에만)
	@mkdir -p \
		/volume2/docker/terab/volumes/db \
		/volume2/docker/terab/volumes/rabbitmq \
		/volume2/docker/terab/services/nginx \
		/volume1/storage

.PHONY: stack
stack: ensure-volumes
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
		--image ghcr.io/idenn207/terab-web:latest \
		--with-registry-auth \
		--force \
		terab_web \
	&& docker service update \
		--image ghcr.io/idenn207/terab-notification:latest \
		--with-registry-auth \
		--force \
		terab_notification

# ─── 로컬 이미지 빌드 ─────────────────────────────────────────────
.PHONY: build-local
build-local:
	docker build -t terab-api:local ./services/api
	docker build -t terab-notification:local ./services/notification
	docker build -t terab-web:local ./services/web

# ─── 빌드 ────────────────────────────────────────────────────────
.PHONY: build-api
build-api:
	cd services/api && ./gradlew build

.PHONY: build-notification
build-notification:
	cd services/notification && ./gradlew build

.PHONY: build-web
build-web:
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
	cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'

.PHONY: notification
notification:
	cd services/notification && ./gradlew bootRun --args='--spring.profiles.active=local'

.PHONY: stop-api
stop-api:
	cd services/api && ./gradlew --stop

.PHONY: stop-notification
stop-notification:
	cd services/notification && ./gradlew --stop


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
test: test-api test-notification test-web

.PHONY: test-api
test-api:
	cd services/api && ./gradlew check

.PHONY: test-api-unit
test-api-unit:
	cd services/api && ./gradlew test

.PHONY: test-api-integration
test-api-integration:
	cd services/api && ./gradlew integrationTest

.PHONY: test-notification
test-notification:
	cd services/notification && ./gradlew check

.PHONY: test-notification-unit
test-notification-unit:
	cd services/notification && ./gradlew test

.PHONY: test-notification-integration
test-notification-integration:
	cd services/notification && ./gradlew integrationTest

.PHONY: test-web
test-web:
	cd services/web && npm test


# ─── Runner ────────────────────────────────────────────────────────
.PHONY: runner
runner:
	docker compose -f docker-compose.runner.yml up
