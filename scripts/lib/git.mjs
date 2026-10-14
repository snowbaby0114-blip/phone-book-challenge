// Thin, dependency-free wrapper around the git CLI.
// Every call is explicit about its repository root so nothing depends on the
// process CWD (the old shell scripts silently packaged the wrong directory when
// run from anywhere other than the repo root).

import { execFileSync } from 'node:child_process';

const MAX_BUFFER = 256 * 1024 * 1024;

/** Run git in `root` and return stdout as a trimmed string. */
export function git(root, args, { env, cwd } = {}) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
  }).trim();
}

/**
 * Run a git command that emits NUL-separated records (`-z`) and return them as
 * an array. NUL separation is what makes paths containing spaces, quotes or
 * newlines survive intact.
 */
export function gitZ(root, args) {
  const out = execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  });
  return out.split('\0').filter((line) => line !== '');
}

/** True when `root` is inside a git working tree. */
export function isGitRepo(root) {
  try {
    return git(root, ['rev-parse', '--is-inside-work-tree']) === 'true';
  } catch {
    return false;
  }
}

/** Throw a human-readable error if the git CLI is unavailable. */
export function assertGitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error('git was not found on your PATH. Install git and try again.');
  }
}

/** Uncommitted (staged, unstaged or untracked) paths, as porcelain records. */
export function dirtyPaths(root) {
  return gitZ(root, ['status', '--porcelain', '-z', '--untracked-files=normal']);
}
