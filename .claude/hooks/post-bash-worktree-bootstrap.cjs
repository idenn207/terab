#!/usr/bin/env node
'use strict';

// PostToolUse(Bash) hook bridge.
// Claude Code 가 Bash 도구로 `git worktree add ...` 를 실행해 성공한 경우,
// scripts/worktree-bootstrap.sh 를 새 worktree 경로 인자로 호출한다.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function findBash() {
  if (process.platform === 'win32') {
    // Makefile 이 사용하는 Git Bash 경로를 우선 사용
    const candidates = [
      'C:/Program Files/Git/usr/bin/bash.exe',
      'C:/Program Files (x86)/Git/usr/bin/bash.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return 'bash';
}

function findRepoRoot(startCwd) {
  let dir = path.resolve(startCwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'scripts', 'worktree-bootstrap.sh'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function extractWorktreePath(command) {
  const m = command.match(/\bgit\s+worktree\s+add\b\s*(.*)$/);
  if (!m) return null;

  // 따옴표가 포함된 경로는 다루지 않음 (일반적인 case 만 처리)
  const tokens = m[1].split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // 값을 가지는 플래그 (-b NEWBRANCH, -B FORCEBRANCH)
    if (t === '-b' || t === '-B') {
      i++;
      continue;
    }
    // 단일 토큰 플래그 (--force, --detach, --no-checkout, --lock, --checkout, --guess-remote, --branch=...)
    if (t.startsWith('-')) continue;
    // 첫 positional = worktree 경로
    return t;
  }
  return null;
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (buf += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(buf);
  } catch (_) {
    return;
  }

  if (input.tool_name !== 'Bash') return;

  const cmd = input.tool_input && input.tool_input.command;
  if (typeof cmd !== 'string' || !cmd) return;

  const resp = input.tool_response || {};
  const exitCode = resp.exit_code ?? resp.exitCode ?? 0;
  if (exitCode !== 0) return;

  const wtPath = extractWorktreePath(cmd);
  if (!wtPath) return;

  const cwd = (input.cwd && typeof input.cwd === 'string') ? input.cwd : process.cwd();
  const root = findRepoRoot(cwd);
  if (!root) {
    process.stderr.write('[worktree-bootstrap-hook] scripts/worktree-bootstrap.sh 를 찾지 못함 — skip\n');
    return;
  }

  const wtAbs = path.isAbsolute(wtPath) ? wtPath : path.resolve(cwd, wtPath);
  const scriptPath = path.join(root, 'scripts', 'worktree-bootstrap.sh');
  const bash = findBash();

  process.stderr.write(`[worktree-bootstrap-hook] new worktree: ${wtAbs}\n`);
  process.stderr.write(`[worktree-bootstrap-hook] running ${path.relative(root, scriptPath)} ...\n`);

  const result = spawnSync(bash, [scriptPath, wtAbs], {
    stdio: 'inherit',
    cwd: root,
  });

  if (result.error) {
    process.stderr.write(`[worktree-bootstrap-hook] spawn 실패: ${result.error.message}\n`);
  } else if (result.status !== 0) {
    process.stderr.write(`[worktree-bootstrap-hook] script exited ${result.status}\n`);
  }
});
