package dsm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
)

// SynowebapiBinary 는 DSM 호스트에 설치된 CLI 의 경로.
// .spk 안에선 PATH 에 노출되어 있으나, 명시적으로 지정해 PATH injection 회피.
const SynowebapiBinary = "/usr/syno/bin/synowebapi"

// ExecFunc 는 외부 CLI 실행 의존성. mock 으로 교체 가능 — fakedsm emulator 가 이 자리에 끼어든다.
// stdout 의 raw bytes 를 반환한다. exit code != 0 이면 error.
type ExecFunc func(ctx context.Context, name string, args ...string) ([]byte, error)

// defaultExec 는 운영 환경의 실 synowebapi 호출. timeout 은 ctx 가 제어.
func defaultExec(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	out, err := cmd.Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return out, fmt.Errorf("synowebapi exit=%d: %s", exitErr.ExitCode(), string(exitErr.Stderr))
		}
		return out, err
	}
	return out, nil
}

// Client 는 dsm 조작 표면. server.DSMClient 인터페이스를 구현한다.
type Client struct {
	binary string
	exec   ExecFunc
}

// NewClient 는 운영용 기본 Client.
func NewClient() *Client {
	return &Client{binary: SynowebapiBinary, exec: defaultExec}
}

// NewClientWithBinary 는 binary 경로만 override 한 Client — e2e 테스트가 fakedsm 을 가리킬 때 사용.
// defaultExec(실 OS exec)는 그대로 사용 — fakedsm 도 동일 cmdline 인터페이스이므로 OK.
func NewClientWithBinary(binary string) *Client {
	return &Client{binary: binary, exec: defaultExec}
}

// NewClientWithExec 는 ExecFunc 를 명시적으로 주입한 Client — 단위 테스트용 (exec 자체를 mock).
func NewClientWithExec(binary string, fn ExecFunc) *Client {
	return &Client{binary: binary, exec: fn}
}

// apiResponse 는 synowebapi 의 공통 envelope.
type apiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *apiError       `json:"error,omitempty"`
}

type apiError struct {
	Code   int              `json:"code"`
	Errors []apiErrorDetail `json:"errors,omitempty"`
}

type apiErrorDetail struct {
	Code int `json:"code"`
}

// DSM 의 SYNO.Core.ISCSI.* error code 매핑. 정확한 값은 spike report 기반 —
// 누락된 코드는 일반 internal error 로 fallback.
const (
	dsmErrTargetConflict = 18990541
	dsmErrTargetNotFound = 18990503
)

func (c *Client) call(ctx context.Context, args ...string) (json.RawMessage, error) {
	out, err := c.exec(ctx, c.binary, args...)
	if err != nil {
		return nil, fmt.Errorf("synowebapi exec failed: %w", err)
	}
	var resp apiResponse
	if err := json.Unmarshal(out, &resp); err != nil {
		return nil, fmt.Errorf("synowebapi response parse failed: %w", err)
	}
	if !resp.Success {
		return nil, mapAPIError(resp.Error)
	}
	return resp.Data, nil
}

func mapAPIError(e *apiError) error {
	if e == nil {
		return errors.New("synowebapi reported success=false with no error body")
	}
	code := e.Code
	for _, d := range e.Errors {
		if d.Code != 0 {
			code = d.Code
			break
		}
	}
	switch code {
	case dsmErrTargetConflict:
		return ErrConflict
	case dsmErrTargetNotFound:
		return ErrNotFound
	default:
		return fmt.Errorf("synowebapi error code=%d", code)
	}
}

// CreateTarget 은 iSCSI target 을 생성하고 DSM 내부 target_id 를 반환한다.
func (c *Client) CreateTarget(ctx context.Context, req CreateTargetRequest) (TargetID, error) {
	args := []string{
		"--exec",
		"api=SYNO.Core.ISCSI.Target",
		"method=create",
		"version=1",
		fmt.Sprintf("name=%q", req.Name),
		fmt.Sprintf("iqn=%q", req.IQN),
		fmt.Sprintf("auth_type=%d", 1),
		fmt.Sprintf("user=%q", req.OSUsername),
		fmt.Sprintf("password=%q", req.OSPassword),
	}
	raw, err := c.call(ctx, args...)
	if err != nil {
		return 0, err
	}
	var data struct {
		TargetID TargetID `json:"target_id"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return 0, fmt.Errorf("createTarget data parse: %w", err)
	}
	return data.TargetID, nil
}

// GetTarget 은 IQN 으로 target 을 조회한다. 없으면 ErrNotFound.
func (c *Client) GetTarget(ctx context.Context, iqn string) (Target, error) {
	args := []string{
		"--exec",
		"api=SYNO.Core.ISCSI.Target",
		"method=list",
		"version=1",
	}
	raw, err := c.call(ctx, args...)
	if err != nil {
		return Target{}, err
	}
	var data struct {
		Targets []struct {
			IQN       string `json:"iqn"`
			Name      string `json:"name"`
			Status    string `json:"status"`
			Connected bool   `json:"connected_sessions_num_gt_zero"`
		} `json:"targets"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return Target{}, fmt.Errorf("getTarget data parse: %w", err)
	}
	for _, t := range data.Targets {
		if t.IQN == iqn {
			return Target{
				IQN:       t.IQN,
				Name:      t.Name,
				Status:    t.Status,
				Connected: t.Connected,
			}, nil
		}
	}
	return Target{}, ErrNotFound
}

// DeleteTarget 은 IQN 으로 target 을 삭제한다. 없으면 ErrNotFound.
func (c *Client) DeleteTarget(ctx context.Context, iqn string) error {
	// 삭제는 target_id 가 필요 — list → IQN 매칭 → id 추출 → delete.
	current, err := c.GetTarget(ctx, iqn)
	if err != nil {
		return err
	}
	_ = current
	args := []string{
		"--exec",
		"api=SYNO.Core.ISCSI.Target",
		"method=delete",
		"version=1",
		fmt.Sprintf("iqn=%q", iqn),
	}
	if _, err := c.call(ctx, args...); err != nil {
		return err
	}
	return nil
}
