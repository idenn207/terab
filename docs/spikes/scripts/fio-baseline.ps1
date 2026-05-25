# fio baseline workloads for the Phase 0 spike (Windows client).
# Plan: .claude/plans/network-storage-reframing-phase0-spike.plan.md (Track A/B measurement)
#
# Runs three workloads against a mounted drive letter (iSCSI or SMB) so the
# raw fio output can be pasted verbatim into the spike report.
#
# Usage:
#   .\docs\spikes\scripts\fio-baseline.ps1 -DriveLetter Z
#
# Requirements: fio.exe on PATH (https://bsdio.com/fio/ or scoop install fio).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z]$')]
    [string]$DriveLetter,

    [string]$Size = '4G',

    [int]$RuntimeSec = 30
)

$ErrorActionPreference = 'Stop'

$drive = "$($DriveLetter.ToUpper()):"
if (-not (Test-Path "$drive\")) {
    Write-Error "Drive $drive is not mounted. Mount the iSCSI/SMB target first."
    exit 1
}

$fio = Get-Command fio.exe -ErrorAction SilentlyContinue
if ($null -eq $fio) {
    Write-Error "fio.exe not found on PATH. Install from https://bsdio.com/fio/ or 'scoop install fio'."
    exit 1
}

$testFile = "$drive\fio-baseline.bin"

try {
    Write-Host "=== host: $env:COMPUTERNAME — $(Get-Date -Format o) ==="
    Write-Host "=== drive: $drive — size=$Size runtime=${RuntimeSec}s ==="
    Write-Host ""

    Write-Host "--- [1/3] sequential read (bs=1M, iodepth=32) ---"
    & fio.exe --name=seq-read `
        --filename=$testFile `
        --rw=read --bs=1M --size=$Size `
        --iodepth=32 --runtime=$RuntimeSec `
        --ioengine=windowsaio --direct=1 `
        --group_reporting
    Write-Host ""

    Write-Host "--- [2/3] random 4K read (bs=4k, iodepth=64) ---"
    & fio.exe --name=rand-read `
        --filename=$testFile `
        --rw=randread --bs=4k --size=$Size `
        --iodepth=64 --runtime=$RuntimeSec `
        --ioengine=windowsaio --direct=1 `
        --group_reporting
    Write-Host ""

    Write-Host "--- [3/3] sequential read (cache-warm, same file, 2nd pass) ---"
    Write-Host "expect: noticeably faster than [1/3] if SSD L2 cache is effective"
    & fio.exe --name=seq-read-warm `
        --filename=$testFile `
        --rw=read --bs=1M --size=$Size `
        --iodepth=32 --runtime=$RuntimeSec `
        --ioengine=windowsaio --direct=0 `
        --group_reporting
    Write-Host ""

    Write-Host "=== done — paste this output into docs/spikes/phase0-steam-network-storage.md ==="
}
finally {
    if (Test-Path $testFile) {
        Remove-Item $testFile -Force -ErrorAction SilentlyContinue
    }
}
