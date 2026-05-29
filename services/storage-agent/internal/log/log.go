package log

import (
	"io"
	"log/slog"
	"os"
	"strings"
)

// New 는 stdout 으로 JSON-line 을 출력하는 slog.Logger 를 만든다.
// level: "debug" | "info" | "warn" | "error" (대소문자 무관). 알 수 없는 값은 info.
func New(level string) *slog.Logger {
	return NewWithWriter(os.Stdout, level)
}

// NewWithWriter 는 io.Writer 를 명시적으로 주입한다 — 테스트용.
func NewWithWriter(w io.Writer, level string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level: parseLevel(level),
	}
	return slog.New(slog.NewJSONHandler(w, opts))
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
