#!/usr/bin/env bash
# wait-for-it.sh — TCP 포트가 열릴 때까지 대기
# Alpine bash 호환 경량 버전

WAITFORIT_cmdname=${0##*/}

echoerr() { if [[ $WAITFORIT_QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

usage() {
  cat << USAGE >&2
Usage:
  $WAITFORIT_cmdname host:port [-t timeout] [-- command args]
  -t TIMEOUT  Timeout in seconds (default: 60)
  -q          Quiet mode
USAGE
  exit 1
}

wait_for() {
  local waitforit_timeout=${WAITFORIT_TIMEOUT:-60}
  local waitforit_start_ts
  waitforit_start_ts=$(date +%s)

  while :; do
    if [[ $WAITFORIT_ISBUSY -eq 1 ]]; then
      nc -z "$WAITFORIT_HOST" "$WAITFORIT_PORT" > /dev/null 2>&1
      WAITFORIT_result=$?
    else
      (echo > /dev/tcp/"$WAITFORIT_HOST"/"$WAITFORIT_PORT") >/dev/null 2>&1
      WAITFORIT_result=$?
    fi

    if [[ $WAITFORIT_result -eq 0 ]]; then
      local waitforit_end_ts
      waitforit_end_ts=$(date +%s)
      echoerr "$WAITFORIT_cmdname: $WAITFORIT_HOST:$WAITFORIT_PORT is available after $((waitforit_end_ts - waitforit_start_ts)) seconds"
      break
    fi

    local waitforit_cur_ts
    waitforit_cur_ts=$(date +%s)
    local waitforit_elapsed=$((waitforit_cur_ts - waitforit_start_ts))
    if [[ $waitforit_timeout -gt 0 && $waitforit_elapsed -ge $waitforit_timeout ]]; then
      echoerr "$WAITFORIT_cmdname: timeout after $waitforit_elapsed seconds waiting for $WAITFORIT_HOST:$WAITFORIT_PORT"
      exit 1
    fi

    sleep 2
  done
}

WAITFORIT_TIMEOUT=60
WAITFORIT_QUIET=0
WAITFORIT_ISBUSY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    *:* )
      WAITFORIT_HOST="${1%%:*}"
      WAITFORIT_PORT="${1##*:}"
      shift 1
      ;;
    -t)
      WAITFORIT_TIMEOUT="$2"
      shift 2
      ;;
    --timeout=*)
      WAITFORIT_TIMEOUT="${1#*=}"
      shift 1
      ;;
    -q | --quiet)
      WAITFORIT_QUIET=1
      shift 1
      ;;
    --)
      shift
      break
      ;;
    --help)
      usage
      ;;
    *)
      echoerr "Unknown argument: $1"
      usage
      ;;
  esac
done

if [[ -z "$WAITFORIT_HOST" || -z "$WAITFORIT_PORT" ]]; then
  echoerr "Error: host:port is required"
  usage
fi

wait_for

if [[ $# -gt 0 ]]; then
  exec "$@"
fi
