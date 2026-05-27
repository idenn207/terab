package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/terab/storage-agent/internal/dsm"
	logpkg "github.com/terab/storage-agent/internal/log"
	"github.com/terab/storage-agent/internal/server"
)

const (
	defaultSocketPath = "/var/packages/terab-agent/var/agent.sock"
	defaultLogLevel   = "info"

	socketPermProduction = 0o660
	socketPermDev        = 0o666

	shutdownGracePeriod = 5 * time.Second
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	socketPath := flag.String("socket", defaultSocketPath, "unix socket path (file is recreated on start)")
	logLevel := flag.String("log-level", defaultLogLevel, "log level: debug | info | warn | error")
	devMode := flag.Bool("dev", false, "dev mode — socket permission 0666 instead of 0660")
	dsmBinary := flag.String("dsm-binary", "", "override synowebapi binary path (testing/emulator only — default: "+dsm.SynowebapiBinary+")")
	flag.Parse()

	logger := logpkg.New(*logLevel)

	if err := cleanupStaleSocket(*socketPath); err != nil {
		return fmt.Errorf("cleanup stale socket: %w", err)
	}

	listener, err := net.Listen("unix", *socketPath)
	if err != nil {
		return fmt.Errorf("listen unix %s: %w", *socketPath, err)
	}

	perm := os.FileMode(socketPermProduction)
	if *devMode {
		perm = os.FileMode(socketPermDev)
	}
	if err := os.Chmod(*socketPath, perm); err != nil {
		return fmt.Errorf("chmod socket %s: %w", *socketPath, err)
	}
	logger.Info("agent socket bound", "path", *socketPath, "perm", fmt.Sprintf("%#o", perm))

	var dsmClient *dsm.Client
	if *dsmBinary != "" {
		dsmClient = dsm.NewClientWithBinary(*dsmBinary)
		logger.Warn("using non-default dsm binary", "path", *dsmBinary)
	} else {
		dsmClient = dsm.NewClient()
	}
	srv := server.New(dsmClient, logger)

	httpServer := &http.Server{
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		serveErr <- httpServer.Serve(listener)
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-stop:
		logger.Info("shutdown signal received", "signal", sig.String())
	case err := <-serveErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("http serve: %w", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), shutdownGracePeriod)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "err", err.Error())
		_ = httpServer.Close()
	}

	if err := os.Remove(*socketPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Warn("socket cleanup failed", "path", *socketPath, "err", err.Error())
	}
	logger.Info("agent stopped cleanly")
	return nil
}

func cleanupStaleSocket(path string) error {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	return os.Remove(path)
}
