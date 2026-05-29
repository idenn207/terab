package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/terab/storage-agent/internal/dsm"
)

type stubDSM struct {
	createID     dsm.TargetID
	createErr    error
	createCalled bool

	getTarget dsm.Target
	getErr    error

	deleteErr    error
	deleteCalled bool
}

func (s *stubDSM) CreateTarget(_ context.Context, _ dsm.CreateTargetRequest) (dsm.TargetID, error) {
	s.createCalled = true
	return s.createID, s.createErr
}

func (s *stubDSM) GetTarget(_ context.Context, _ string) (dsm.Target, error) {
	return s.getTarget, s.getErr
}

func (s *stubDSM) DeleteTarget(_ context.Context, _ string) error {
	s.deleteCalled = true
	return s.deleteErr
}

func newTestServer(t *testing.T, stub *stubDSM) *httptest.Server {
	t.Helper()
	srv := New(stub, nil)
	return httptest.NewServer(srv.Handler())
}

func TestHealthz(t *testing.T) {
	ts := newTestServer(t, &stubDSM{})
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}
}

func TestCreateTargetHappyPath(t *testing.T) {
	stub := &stubDSM{createID: 7}
	ts := newTestServer(t, stub)
	defer ts.Close()

	payload := `{"iqn":"iqn.2026-05.com.terab:d1","name":"d1","osUsername":"u","osPassword":"p"}`
	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, want 201. body=%s", resp.StatusCode, body)
	}
	if !stub.createCalled {
		t.Error("createTarget was not called")
	}
}

func TestCreateTargetMissingIQN(t *testing.T) {
	ts := newTestServer(t, &stubDSM{})
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(`{"name":"d1"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
	var body ErrorBody
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Error.Code != codeBadRequest {
		t.Errorf("code = %q, want %q", body.Error.Code, codeBadRequest)
	}
}

func TestCreateTargetMalformedJSON(t *testing.T) {
	ts := newTestServer(t, &stubDSM{})
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(`not json`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateTargetEmptyBody(t *testing.T) {
	ts := newTestServer(t, &stubDSM{})
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(``))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateTargetUnknownField(t *testing.T) {
	ts := newTestServer(t, &stubDSM{})
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(`{"iqn":"x","trojan":"y"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateTargetPayloadTooLarge(t *testing.T) {
	ts := newTestServer(t, &stubDSM{})
	defer ts.Close()

	big := make([]byte, MaxRequestBytes+1024)
	for i := range big {
		big[i] = 'a'
	}
	body := bytes.NewBuffer([]byte(`{"iqn":"x","name":"`))
	body.Write(big)
	body.WriteString(`"}`)

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", body)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want 413", resp.StatusCode)
	}
}

func TestCreateTargetConflictMapped(t *testing.T) {
	stub := &stubDSM{createErr: dsm.ErrConflict}
	ts := newTestServer(t, stub)
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(`{"iqn":"x","name":"d"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("status = %d, want 409", resp.StatusCode)
	}
	var body ErrorBody
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body.Error.Code != codeTargetConflict {
		t.Errorf("code = %q, want %q", body.Error.Code, codeTargetConflict)
	}
}

func TestCreateTargetInternalError(t *testing.T) {
	stub := &stubDSM{createErr: errors.New("boom")}
	ts := newTestServer(t, stub)
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/targets", "application/json", strings.NewReader(`{"iqn":"x","name":"d"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", resp.StatusCode)
	}
	var body ErrorBody
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body.Error.Code != codeInternal {
		t.Errorf("code = %q, want %q", body.Error.Code, codeInternal)
	}
}

func TestGetTargetHappyPath(t *testing.T) {
	stub := &stubDSM{getTarget: dsm.Target{IQN: "x", Name: "d", Status: "ready"}}
	ts := newTestServer(t, stub)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/v1/targets/x")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body struct {
		Data dsm.Target `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Data.Name != "d" {
		t.Errorf("name = %q, want %q", body.Data.Name, "d")
	}
}

func TestGetTargetNotFound(t *testing.T) {
	stub := &stubDSM{getErr: dsm.ErrNotFound}
	ts := newTestServer(t, stub)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/v1/targets/x")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestDeleteTargetHappyPath(t *testing.T) {
	stub := &stubDSM{}
	ts := newTestServer(t, stub)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodDelete, ts.URL+"/v1/targets/x", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("status = %d, want 204", resp.StatusCode)
	}
	if !stub.deleteCalled {
		t.Error("deleteTarget was not called")
	}
}

func TestDeleteTargetNotFound(t *testing.T) {
	stub := &stubDSM{deleteErr: dsm.ErrNotFound}
	ts := newTestServer(t, stub)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodDelete, ts.URL+"/v1/targets/x", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestDeleteTargetInternalError(t *testing.T) {
	stub := &stubDSM{deleteErr: errors.New("boom")}
	ts := newTestServer(t, stub)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodDelete, ts.URL+"/v1/targets/x", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", resp.StatusCode)
	}
}

func TestNewNilLoggerFallsBackToDefault(t *testing.T) {
	srv := New(&stubDSM{}, nil)
	if srv.logger == nil {
		t.Error("nil logger should fall back to slog.Default(), got nil")
	}
}
