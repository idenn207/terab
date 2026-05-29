// fakedsm 은 synowebapi CLI 의 응답을 in-memory 로 흉내내는 stub 바이너리.
// agent 의 internal/dsm.ExecFunc 가 PATH 에서 이걸 찾으면, 실 DSM 호스트 없이
// agent 통합 테스트가 가능하다. 상태는 FAKEDSM_STATE_FILE 환경변수가 가리키는
// JSON 파일에 보관 — 단일 테스트 시나리오 안에서 read-modify-write 로 충분.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

const (
	stateEnvVar      = "FAKEDSM_STATE_FILE"
	defaultStatePath = "/tmp/fakedsm-state.json"

	apiTarget = "SYNO.Core.ISCSI.Target"

	dsmErrTargetConflict = 18990541
	dsmErrTargetNotFound = 18990503
	dsmErrUnsupported    = 19990001
)

type fakeTarget struct {
	ID        int64  `json:"id"`
	IQN       string `json:"iqn"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Connected bool   `json:"connected"`
}

type fakeState struct {
	Targets []fakeTarget `json:"targets"`
	NextID  int64        `json:"next_id"`
}

type apiError struct {
	Code int `json:"code"`
}

type response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *apiError   `json:"error,omitempty"`
}

func main() {
	args := os.Args[1:]
	if len(args) == 0 || args[0] != "--exec" {
		emitError(dsmErrUnsupported)
		return
	}
	params := parseParams(args[1:])

	if params["api"] != apiTarget {
		emitError(dsmErrUnsupported)
		return
	}

	statePath := os.Getenv(stateEnvVar)
	if statePath == "" {
		statePath = defaultStatePath
	}

	switch params["method"] {
	case "create":
		handleCreate(statePath, params)
	case "list":
		handleList(statePath)
	case "delete":
		handleDelete(statePath, params)
	default:
		emitError(dsmErrUnsupported)
	}
}

func handleCreate(statePath string, params map[string]string) {
	state, err := loadState(statePath)
	if err != nil {
		fail(err)
		return
	}
	iqn := params["iqn"]
	if iqn == "" {
		emitError(dsmErrUnsupported)
		return
	}
	for _, t := range state.Targets {
		if t.IQN == iqn {
			emitError(dsmErrTargetConflict)
			return
		}
	}
	state.NextID++
	state.Targets = append(state.Targets, fakeTarget{
		ID:     state.NextID,
		IQN:    iqn,
		Name:   params["name"],
		Status: "available",
	})
	if err := saveState(statePath, state); err != nil {
		fail(err)
		return
	}
	emit(response{Success: true, Data: map[string]interface{}{"target_id": state.NextID}})
}

func handleList(statePath string) {
	state, err := loadState(statePath)
	if err != nil {
		fail(err)
		return
	}
	wire := make([]map[string]interface{}, 0, len(state.Targets))
	for _, t := range state.Targets {
		wire = append(wire, map[string]interface{}{
			"iqn":                              t.IQN,
			"name":                             t.Name,
			"status":                           t.Status,
			"connected_sessions_num_gt_zero":   t.Connected,
		})
	}
	emit(response{Success: true, Data: map[string]interface{}{"targets": wire}})
}

func handleDelete(statePath string, params map[string]string) {
	state, err := loadState(statePath)
	if err != nil {
		fail(err)
		return
	}
	iqn := params["iqn"]
	if iqn == "" {
		emitError(dsmErrTargetNotFound)
		return
	}
	filtered := state.Targets[:0]
	removed := false
	for _, t := range state.Targets {
		if t.IQN == iqn {
			removed = true
			continue
		}
		filtered = append(filtered, t)
	}
	if !removed {
		emitError(dsmErrTargetNotFound)
		return
	}
	state.Targets = filtered
	if err := saveState(statePath, state); err != nil {
		fail(err)
		return
	}
	emit(response{Success: true, Data: map[string]interface{}{}})
}

// agent 가 args 를 `name=%q iqn=%q ...` 형태로 전달 — value 가 양끝 쌍따옴표로 감싸짐.
// 여기서 trim 해 raw value 를 복원.
func parseParams(args []string) map[string]string {
	out := make(map[string]string, len(args))
	for _, a := range args {
		idx := strings.Index(a, "=")
		if idx < 0 {
			continue
		}
		key := a[:idx]
		value := a[idx+1:]
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			value = value[1 : len(value)-1]
		}
		out[key] = value
	}
	return out
}

func loadState(path string) (*fakeState, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return &fakeState{}, nil
	}
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return &fakeState{}, nil
	}
	var s fakeState
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func saveState(path string, s *fakeState) error {
	buf, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, buf, 0o600)
}

func emit(r response) {
	if err := json.NewEncoder(os.Stdout).Encode(r); err != nil {
		fail(err)
	}
}

func emitError(code int) {
	emit(response{Success: false, Error: &apiError{Code: code}})
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "fakedsm:", err)
	os.Exit(1)
}
