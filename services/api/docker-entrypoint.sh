#!/bin/sh
# Spring Boot configtree가 /run/secrets/ 에서 시크릿을 직접 읽으므로
# 이 스크립트는 DB 준비 대기만 담당한다.
set -e

exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
