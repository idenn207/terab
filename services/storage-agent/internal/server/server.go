package server

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/terab/storage-agent/internal/dsm"
)

// MaxRequestBytes 는 단일 요청 body 의 최대 크기. DoS 방어.
const MaxRequestBytes = 1 << 20

// DSMClient 는 server 가 의존하는 DSM 조작 표면.
// 인터페이스를 consumer 측(server)에 두어 dsm.Client 의 mock 주입을 용이하게 만든다.
type DSMClient interface {
	CreateTarget(ctx context.Context, req dsm.CreateTargetRequest) (dsm.TargetID, error)
	GetTarget(ctx context.Context, iqn string) (dsm.Target, error)
	DeleteTarget(ctx context.Context, iqn string) error
}

// Server 는 HTTP 핸들러를 라우팅한다.
type Server struct {
	dsm    DSMClient
	logger *slog.Logger
}

func New(dsmClient DSMClient, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{dsm: dsmClient, logger: logger}
}

// Handler 는 라우팅 트리를 만들어 http.Handler 로 노출한다.
// Go 1.22 의 path-pattern ServeMux 를 사용해 외부 라우터 의존을 0 으로 유지.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("POST /v1/targets", s.handleCreateTarget)
	mux.HandleFunc("GET /v1/targets/{iqn}", s.handleGetTarget)
	mux.HandleFunc("DELETE /v1/targets/{iqn}", s.handleDeleteTarget)
	return mux
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Default().Error("response encode failed", "err", err)
	}
}

// ErrorBody 는 4xx/5xx 응답의 envelope.
// NestJS ApiException 응답 형식과 정합.
type ErrorBody struct {
	Error ErrorPayload `json:"error"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, ErrorBody{Error: ErrorPayload{Code: code, Message: message}})
}
