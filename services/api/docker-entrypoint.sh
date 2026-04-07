#!/bin/sh
# Docker Secrets 파일을 환경변수로 변환한 뒤 Spring Boot를 기동한다.
# Swarm: /run/secrets/<name> 파일에서 읽음
# docker-compose (로컬): 환경변수 직접 주입 허용 (폴백)
set -e

read_secret() {
  secret_name="$1"
  env_var="$2"
  secret_file="/run/secrets/$secret_name"

  if [ -f "$secret_file" ]; then
    cat "$secret_file"
  elif [ -n "$(eval echo \$$env_var)" ]; then
    eval echo \$$env_var
  else
    echo "FATAL: '$secret_name' not found in /run/secrets/ and $env_var env var is not set" >&2
    exit 1
  fi
}

DB_PASSWORD=$(read_secret terab_db_password DB_PASSWORD)
MINIO_SECRET_KEY=$(read_secret terab_minio_password MINIO_SECRET_KEY)
JWT_SECRET=$(read_secret terab_jwt_secret JWT_SECRET)
export DB_PASSWORD MINIO_SECRET_KEY JWT_SECRET

exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
