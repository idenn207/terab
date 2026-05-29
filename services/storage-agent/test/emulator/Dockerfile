FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
COPY test ./test

RUN CGO_ENABLED=0 go build -o /out/agent ./cmd/agent && \
    CGO_ENABLED=0 go build -o /out/fakedsm ./test/emulator/fakedsm

FROM alpine:3.19

RUN apk add --no-cache curl ca-certificates

COPY --from=builder /out/agent /usr/local/bin/agent
COPY --from=builder /out/fakedsm /usr/local/bin/fakedsm

# agent 는 synowebapi.SynowebapiBinary 상수(/usr/syno/bin/synowebapi)로 PATH 우회 호출.
# 그 경로를 fakedsm 으로 symlink 해 emulator 모드를 만든다.
RUN mkdir -p /usr/syno/bin && \
    ln -s /usr/local/bin/fakedsm /usr/syno/bin/synowebapi

RUN mkdir -p /var/lib/terab-agent && \
    chmod 0777 /var/lib/terab-agent

ENV FAKEDSM_STATE_FILE=/var/lib/terab-agent/fakedsm-state.json

ENTRYPOINT ["/usr/local/bin/agent"]
CMD ["-socket", "/var/lib/terab-agent/agent.sock", "-log-level", "info", "-dev"]
