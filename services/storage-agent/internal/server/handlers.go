package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/terab/storage-agent/internal/dsm"
)

// ErrorCode 는 4xx/5xx 응답에 실리는 식별자. NestJS ErrorCode enum 과 동기 유지.
const (
	codeBadRequest     = "BAD_REQUEST"
	codePayloadTooLarge = "PAYLOAD_TOO_LARGE"
	codeTargetNotFound = "TARGET_NOT_FOUND"
	codeTargetConflict = "TARGET_CONFLICT"
	codeInternal       = "INTERNAL"
)

type createTargetResponse struct {
	Data createTargetData `json:"data"`
}

type createTargetData struct {
	ID  dsm.TargetID `json:"id"`
	IQN string       `json:"iqn"`
}

func (s *Server) handleCreateTarget(w http.ResponseWriter, r *http.Request) {
	var req dsm.CreateTargetRequest
	if err := decodeJSON(r, &req); err != nil {
		s.respondDecodeError(w, err)
		return
	}
	if req.IQN == "" {
		writeError(w, http.StatusBadRequest, codeBadRequest, "iqn is required")
		return
	}

	id, err := s.dsm.CreateTarget(r.Context(), req)
	if err != nil {
		s.respondDSMError(w, err, "createTarget", req.IQN)
		return
	}
	writeJSON(w, http.StatusCreated, createTargetResponse{
		Data: createTargetData{ID: id, IQN: req.IQN},
	})
}

type getTargetResponse struct {
	Data dsm.Target `json:"data"`
}

func (s *Server) handleGetTarget(w http.ResponseWriter, r *http.Request) {
	iqn := r.PathValue("iqn")
	if iqn == "" {
		writeError(w, http.StatusBadRequest, codeBadRequest, "iqn path segment is required")
		return
	}

	target, err := s.dsm.GetTarget(r.Context(), iqn)
	if err != nil {
		s.respondDSMError(w, err, "getTarget", iqn)
		return
	}
	writeJSON(w, http.StatusOK, getTargetResponse{Data: target})
}

func (s *Server) handleDeleteTarget(w http.ResponseWriter, r *http.Request) {
	iqn := r.PathValue("iqn")
	if iqn == "" {
		writeError(w, http.StatusBadRequest, codeBadRequest, "iqn path segment is required")
		return
	}

	if err := s.dsm.DeleteTarget(r.Context(), iqn); err != nil {
		s.respondDSMError(w, err, "deleteTarget", iqn)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, MaxRequestBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func (s *Server) respondDecodeError(w http.ResponseWriter, err error) {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		writeError(w, http.StatusRequestEntityTooLarge, codePayloadTooLarge, "request body too large")
		return
	}
	if errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, codeBadRequest, "request body is empty")
		return
	}
	writeError(w, http.StatusBadRequest, codeBadRequest, "invalid JSON: "+err.Error())
}

func (s *Server) respondDSMError(w http.ResponseWriter, err error, op, iqn string) {
	switch {
	case errors.Is(err, dsm.ErrNotFound):
		writeError(w, http.StatusNotFound, codeTargetNotFound, err.Error())
	case errors.Is(err, dsm.ErrConflict):
		writeError(w, http.StatusConflict, codeTargetConflict, err.Error())
	default:
		s.logger.Error("dsm operation failed", "op", op, "iqn", iqn, "err", err.Error())
		writeError(w, http.StatusInternalServerError, codeInternal, "agent internal error")
	}
}
