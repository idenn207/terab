#!/bin/sh
# 환경변수는 docker-compose env_file로 주입됨 — 별도 secret 파일 처리 불필요
set -e

exec wait-for-it.sh db:5432 --timeout=30 -- node dist/main.js
