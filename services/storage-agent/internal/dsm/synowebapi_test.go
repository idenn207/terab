package dsm

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func newTestClient(out []byte, err error) *Client {
	return NewClientWithExec("fakebin", func(_ context.Context, _ string, _ ...string) ([]byte, error) {
		return out, err
	})
}

func TestCreateTargetHappyPath(t *testing.T) {
	resp := []byte(`{"success": true, "data": {"target_id": 42}}`)
	c := newTestClient(resp, nil)
	id, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "iqn.2026-05.com.terab:d1", Name: "d1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != 42 {
		t.Errorf("got TargetID=%d, want 42", id)
	}
}

func TestCreateTargetCLINotFound(t *testing.T) {
	c := newTestClient(nil, errors.New("exec: 'fakebin': executable file not found in $PATH"))
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "iqn.2026-05.com.terab:x"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "synowebapi exec failed") {
		t.Errorf("error message missing exec failed marker: %v", err)
	}
}

func TestCreateTargetMalformedJSON(t *testing.T) {
	c := newTestClient([]byte("not json at all"), nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if err == nil {
		t.Fatal("expected parse error, got nil")
	}
	if !strings.Contains(err.Error(), "response parse failed") {
		t.Errorf("error did not mention parse failure: %v", err)
	}
}

func TestCreateTargetSuccessFalseConflict(t *testing.T) {
	resp := []byte(`{"success": false, "error": {"code": 18990541}}`)
	c := newTestClient(resp, nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if !errors.Is(err, ErrConflict) {
		t.Errorf("got %v, want ErrConflict", err)
	}
}

func TestCreateTargetSuccessFalseNotFound(t *testing.T) {
	resp := []byte(`{"success": false, "error": {"code": 18990503}}`)
	c := newTestClient(resp, nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestCreateTargetSuccessFalseUnmappedCode(t *testing.T) {
	resp := []byte(`{"success": false, "error": {"code": 99999999}}`)
	c := newTestClient(resp, nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "99999999") {
		t.Errorf("error did not include unmapped code: %v", err)
	}
}

func TestCreateTargetSuccessFalseNoErrorBody(t *testing.T) {
	resp := []byte(`{"success": false}`)
	c := newTestClient(resp, nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestCreateTargetDataParseFailure(t *testing.T) {
	resp := []byte(`{"success": true, "data": {"target_id": "not-a-number"}}`)
	c := newTestClient(resp, nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if err == nil {
		t.Fatal("expected data parse error, got nil")
	}
	if !strings.Contains(err.Error(), "createTarget data parse") {
		t.Errorf("error did not mention data parse: %v", err)
	}
}

func TestCreateTargetNestedErrorCodeFallback(t *testing.T) {
	resp := []byte(`{"success": false, "error": {"code": 0, "errors": [{"code": 18990541}]}}`)
	c := newTestClient(resp, nil)
	_, err := c.CreateTarget(context.Background(), CreateTargetRequest{IQN: "x"})
	if !errors.Is(err, ErrConflict) {
		t.Errorf("nested errors[].code should map to ErrConflict, got %v", err)
	}
}

func TestGetTargetFoundAndNotFound(t *testing.T) {
	listResp := []byte(`{"success": true, "data": {"targets": [{"iqn": "iqn.2026-05.com.terab:d1", "name": "d1", "status": "ready", "connected_sessions_num_gt_zero": true}]}}`)
	c := newTestClient(listResp, nil)
	got, err := c.GetTarget(context.Background(), "iqn.2026-05.com.terab:d1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Name != "d1" || got.Status != "ready" || !got.Connected {
		t.Errorf("unexpected target: %+v", got)
	}

	_, err = c.GetTarget(context.Background(), "iqn.2026-05.com.terab:missing")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("missing IQN should yield ErrNotFound, got %v", err)
	}
}

func TestGetTargetParseFailure(t *testing.T) {
	resp := []byte(`{"success": true, "data": ["wrong shape"]}`)
	c := newTestClient(resp, nil)
	_, err := c.GetTarget(context.Background(), "x")
	if err == nil {
		t.Fatal("expected parse error, got nil")
	}
}

func TestGetTargetCallError(t *testing.T) {
	c := newTestClient(nil, errors.New("synowebapi exit=1"))
	_, err := c.GetTarget(context.Background(), "x")
	if err == nil {
		t.Fatal("expected error from call, got nil")
	}
}

func TestDeleteTargetHappyPath(t *testing.T) {
	calls := 0
	c := NewClientWithExec("fakebin", func(_ context.Context, _ string, args ...string) ([]byte, error) {
		calls++
		for _, a := range args {
			if strings.HasPrefix(a, "method=list") {
				return []byte(`{"success": true, "data": {"targets": [{"iqn": "iqn.2026-05.com.terab:d1", "name": "d1", "status": "ready"}]}}`), nil
			}
		}
		return []byte(`{"success": true, "data": {}}`), nil
	})
	if err := c.DeleteTarget(context.Background(), "iqn.2026-05.com.terab:d1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 2 {
		t.Errorf("expected list + delete = 2 calls, got %d", calls)
	}
}

func TestDeleteTargetMissingIsNotFound(t *testing.T) {
	c := newTestClient([]byte(`{"success": true, "data": {"targets": []}}`), nil)
	err := c.DeleteTarget(context.Background(), "iqn.2026-05.com.terab:d1")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestDeleteTargetDeletePhaseError(t *testing.T) {
	calls := 0
	c := NewClientWithExec("fakebin", func(_ context.Context, _ string, args ...string) ([]byte, error) {
		calls++
		for _, a := range args {
			if strings.HasPrefix(a, "method=list") {
				return []byte(`{"success": true, "data": {"targets": [{"iqn": "x"}]}}`), nil
			}
		}
		return []byte(`{"success": false, "error": {"code": 99999999}}`), nil
	})
	err := c.DeleteTarget(context.Background(), "x")
	if err == nil {
		t.Fatal("expected delete-phase error, got nil")
	}
	if calls != 2 {
		t.Errorf("expected 2 calls (list + delete), got %d", calls)
	}
}

func TestNewClientUsesDefaultBinary(t *testing.T) {
	c := NewClient()
	if c.binary != SynowebapiBinary {
		t.Errorf("NewClient().binary = %q, want %q", c.binary, SynowebapiBinary)
	}
	if c.exec == nil {
		t.Error("NewClient().exec is nil")
	}
}
