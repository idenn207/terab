#!/usr/bin/env bash
# fio baseline workloads for the Phase 0 spike (NAS host, Linux).
# Plan: .claude/plans/network-storage-reframing-phase0-spike.plan.md (Task 1)
#
# Runs three workloads against TARGET_DIR and prints raw fio output so the
# results can be pasted verbatim into the spike report.
#
# Usage:
#   bash docs/spikes/scripts/fio-baseline.sh /path/on/raid5
#
# Requirements: fio installed (apt install fio).

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-dir>" >&2
  echo "  target-dir must be on the storage tier you want to measure" >&2
  exit 2
fi

TARGET_DIR="$1"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "ERROR: target dir does not exist: $TARGET_DIR" >&2
  exit 1
fi

if ! command -v fio >/dev/null 2>&1; then
  echo "ERROR: fio not installed (try: apt install fio)" >&2
  exit 1
fi

TEST_FILE="$TARGET_DIR/fio-baseline.bin"
SIZE="${FIO_SIZE:-4G}"
RUNTIME="${FIO_RUNTIME:-30}"

cleanup() {
  rm -f "$TEST_FILE"
}
trap cleanup EXIT

echo "=== host: $(hostname) — $(date -Iseconds) ==="
echo "=== target: $TARGET_DIR — size=$SIZE runtime=${RUNTIME}s ==="
echo

echo "--- [1/3] sequential read (bs=1M, iodepth=32) ---"
fio --name=seq-read \
    --filename="$TEST_FILE" \
    --rw=read --bs=1M --size="$SIZE" \
    --iodepth=32 --runtime="$RUNTIME" \
    --ioengine=libaio --direct=1 \
    --group_reporting
echo

echo "--- [2/3] random 4K read (bs=4k, iodepth=64) ---"
fio --name=rand-read \
    --filename="$TEST_FILE" \
    --rw=randread --bs=4k --size="$SIZE" \
    --iodepth=64 --runtime="$RUNTIME" \
    --ioengine=libaio --direct=1 \
    --group_reporting
echo

echo "--- [3/3] sequential read (cache-warm, same file, 2nd pass) ---"
echo "expect: noticeably faster than [1/3] if SSD L2 cache is effective"
fio --name=seq-read-warm \
    --filename="$TEST_FILE" \
    --rw=read --bs=1M --size="$SIZE" \
    --iodepth=32 --runtime="$RUNTIME" \
    --ioengine=libaio --direct=0 \
    --group_reporting
echo

echo "=== done — paste this output into docs/spikes/phase0-steam-network-storage.md ==="
