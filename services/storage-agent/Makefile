SHELL := /bin/bash

PKG_NAME    := terab-agent
PKG_VERSION ?= 0.1.0
PKG_ARCH    ?= x86_64

BIN_DIR           := bin
TMP_DIR           := tmp
AGENT_BIN         := $(BIN_DIR)/agent
AGENT_BIN_LINUX_AMD64 := $(BIN_DIR)/agent-linux-amd64
AGENT_BIN_LINUX_ARM64 := $(BIN_DIR)/agent-linux-arm64
FAKEDSM_BIN       := $(BIN_DIR)/fakedsm
SPK_FILE          := $(BIN_DIR)/$(PKG_NAME)-$(PKG_VERSION).spk
SPK_STAGE         := $(TMP_DIR)/spk
EMULATOR_IMAGE    ?= terab/storage-agent-emulator:dev

DEV_SOCKET ?= /tmp/terab-agent.sock

GO ?= go

# Use GNU tar — Windows 의 cmd.exe PATH 에서는 bsdtar 가 먼저 잡히므로 Git Bash 의 tar 를 절대 경로로 명시
TAR ?= tar
ifeq ($(OS),Windows_NT)
  TAR := "C:/Program Files/Git/usr/bin/tar.exe"
endif

.PHONY: help
help:
	@echo "Targets:"
	@echo "  build              — build agent for current OS into $(AGENT_BIN)"
	@echo "  build-linux-amd64  — cross-compile for DSM x86_64"
	@echo "  build-linux-arm64  — cross-compile for DSM arm64"
	@echo "  test               — go test ./... -cover"
	@echo "  vet                — go vet ./..."
	@echo "  tidy               — go mod tidy"
	@echo "  spk                — package agent as Synology .spk into $(SPK_FILE)"
	@echo "  fakedsm            — build fakedsm stub binary (for tests outside Docker)"
	@echo "  emulator-image     — docker build agent+fakedsm test image ($(EMULATOR_IMAGE))"
	@echo "  install-dev        — build + print dev socket usage hint"
	@echo "  clean              — remove bin/ and tmp/"

.PHONY: build
build:
	$(GO) build -o $(AGENT_BIN) ./cmd/agent

.PHONY: build-linux-amd64
build-linux-amd64:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 $(GO) build -o $(AGENT_BIN_LINUX_AMD64) ./cmd/agent

.PHONY: build-linux-arm64
build-linux-arm64:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 $(GO) build -o $(AGENT_BIN_LINUX_ARM64) ./cmd/agent

.PHONY: test
test:
	$(GO) test ./... -cover

.PHONY: vet
vet:
	$(GO) vet ./...

.PHONY: tidy
tidy:
	$(GO) mod tidy

# Synology .spk = tar(INFO + package.tgz + scripts/).
# arch=x86_64 default; override with `make spk PKG_ARCH=arm64` for DSM arm models.
.PHONY: spk
spk: build-linux-amd64
	@$(TAR) --version >/dev/null 2>&1 || { echo "[spk] $(TAR) is required (GNU tar)" >&2; exit 1; }
	@rm -rf $(SPK_STAGE)
	@mkdir -p $(SPK_STAGE)/package $(SPK_STAGE)/scripts $(BIN_DIR)
	@sed -e 's/__PKG_VERSION__/$(PKG_VERSION)/' \
	     -e 's/__PKG_ARCH__/$(PKG_ARCH)/' \
	     spk/INFO.tmpl > $(SPK_STAGE)/INFO
	@mkdir -p $(SPK_STAGE)/package/bin
	@cp $(AGENT_BIN_LINUX_AMD64) $(SPK_STAGE)/package/bin/agent
	@chmod 0755 $(SPK_STAGE)/package/bin/agent
	@cp -R spk/scripts/. $(SPK_STAGE)/scripts/
	@chmod 0755 $(SPK_STAGE)/scripts/*
	@$(TAR) --owner=0 --group=0 --mode=0755 -C $(SPK_STAGE)/package -czf $(SPK_STAGE)/package.tgz .
	@rm -rf $(SPK_STAGE)/package
	@$(TAR) --owner=0 --group=0 --mode=0644 -C $(SPK_STAGE) -cf $(SPK_FILE) INFO package.tgz
	@$(TAR) --owner=0 --group=0 --mode=0755 -C $(SPK_STAGE) -rf $(SPK_FILE) scripts
	@rm -rf $(SPK_STAGE)
	@echo "[spk] produced $(SPK_FILE)"

.PHONY: fakedsm
fakedsm:
	$(GO) build -o $(FAKEDSM_BIN) ./test/emulator/fakedsm

.PHONY: emulator-image
emulator-image:
	@command -v docker >/dev/null 2>&1 || { echo "[emulator-image] docker is required" >&2; exit 1; }
	docker build -f test/emulator/Dockerfile -t $(EMULATOR_IMAGE) .

.PHONY: install-dev
install-dev: build
	@echo "Run with:  $(AGENT_BIN) -socket $(DEV_SOCKET) -log-level debug"

.PHONY: clean
clean:
	rm -rf $(BIN_DIR) $(TMP_DIR)
