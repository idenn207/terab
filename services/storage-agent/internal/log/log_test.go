package log

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

func TestParseLevel(t *testing.T) {
	cases := []struct {
		in   string
		want slog.Level
	}{
		{"debug", slog.LevelDebug},
		{"DEBUG", slog.LevelDebug},
		{"info", slog.LevelInfo},
		{"warn", slog.LevelWarn},
		{"warning", slog.LevelWarn},
		{"error", slog.LevelError},
		{"unknown", slog.LevelInfo},
		{"", slog.LevelInfo},
		{"  debug  ", slog.LevelDebug},
	}
	for _, c := range cases {
		got := parseLevel(c.in)
		if got != c.want {
			t.Errorf("parseLevel(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestNewWithWriterEmitsJSON(t *testing.T) {
	var buf bytes.Buffer
	logger := NewWithWriter(&buf, "info")
	logger.Info("test event", "userId", 42)

	line := strings.TrimSpace(buf.String())
	if line == "" {
		t.Fatal("expected log output, got empty buffer")
	}

	var got map[string]any
	if err := json.Unmarshal([]byte(line), &got); err != nil {
		t.Fatalf("log line is not valid JSON: %v\nline: %s", err, line)
	}
	if got["msg"] != "test event" {
		t.Errorf("msg = %v, want %q", got["msg"], "test event")
	}
	if got["userId"] != float64(42) {
		t.Errorf("userId = %v, want 42", got["userId"])
	}
}

func TestNewWithWriterRespectsLevel(t *testing.T) {
	var buf bytes.Buffer
	logger := NewWithWriter(&buf, "warn")
	logger.Info("should be suppressed")
	if buf.Len() != 0 {
		t.Errorf("info-level log emitted under warn threshold: %s", buf.String())
	}

	buf.Reset()
	logger.Warn("should be emitted")
	if buf.Len() == 0 {
		t.Error("warn-level log was suppressed under warn threshold")
	}
}
