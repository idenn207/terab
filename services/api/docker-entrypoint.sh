#!/bin/sh
# Docker Secrets 파일을 환경변수로 변환한 뒤 Spring Boot를 기동한다.
# /run/secrets/<name> 파일이 마운트되지 않으면 즉시 종료한다.
set -e

REQUIRED_SECRET_FILES="terab_db_password terab_minio_password terab_jwt_secret"
for f in $REQUIRED_SECRET_FILES; do
  if [ ! -f "/run/secrets/$f" ]; then
    echo "FATAL: Docker secret '$f' is not mounted at /run/secrets/$f"
    exit 1
  fi
done

DB_PASSWORD=$(cat /run/secrets/terab_db_password)
MINIO_SECRET_KEY=$(cat /run/secrets/terab_minio_password)
JWT_SECRET=$(cat /run/secrets/terab_jwt_secret)
export DB_PASSWORD MINIO_SECRET_KEY JWT_SECRET

exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
