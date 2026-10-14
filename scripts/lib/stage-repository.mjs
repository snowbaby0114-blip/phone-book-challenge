// Builds the seeded single-commit repository that ships to a candidate.
//
// All of this happens in a throwaway directory under os.tmpdir(). The source
// repository is never written to — the shell version this replaces moved the
// real git directory to /tmp and deleted it afterwards, which silently reverted
// the repository to an older state whenever a stale copy was already there.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { git, dirtyPaths } from './git.mjs';
import { isVolatileGitPath } from './repo-files.mjs';
import { walkFiles } from './fs-walk.mjs';

export const COMMIT_NAME = 'EyeCarePro Tech Challenge';
export const COMMIT_EMAIL = 'tech.challenge@eyecarepro.net';
export const COMMIT_MESSAGE = 'Initial commit';
// Pinned so the same tree always yields the same commit SHA and no packing
// timestamp leaks into the candidate's history. (The archive itself is not
// byte-identical between runs: the git index embeds file stat data.)
export const COMMIT_DATE = '2026-01-01T00:00:00+0000';
export const DEFAULT_BRANCH = 'master';

/** Read a local-scope config value, tolerating its absence. */
function localConfig(root, key) {
  try {
    return git(root, ['config', '--local', '--get', key]);
  } catch {
    return '';
  }
}

/** Copy the packable files into a fresh temporary directory. */
function copyFiles(files) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'phone-book-pack-'));
  for (const file of files) {
    const destination = path.join(stage, file.relPath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file.absPath, destination);
    try {
      fs.chmodSync(destination, file.mode);
    } catch {
      // Windows cannot set the executable bit; git update-index handles it below.
    }
  }
  return stage;
}

/** Confirm the staged repository is exactly what a candidate should receive. */
function assertStageIsClean(stage) {
  const commitCount = Number(git(stage, ['rev-list', '--count', 'HEAD']));
  if (commitCount !== 1) throw new Error(`Staged repository has ${commitCount} commits; expected exactly 1.`);
  if (git(stage, ['remote']) !== '') throw new Error('Staged repository unexpectedly has a remote configured.');
  if (dirtyPaths(stage).length !== 0) {
    throw new Error('Staged repository is dirty after committing; the archive would extract with pending changes.');
  }
  // --local on purpose: a global identity is the packer's own and is irrelevant.
  for (const key of ['user.name', 'user.email']) {
    if (localConfig(stage, key) !== '') {
      throw new Error(`Staged repository has a local ${key}; candidate commits would be misattributed.`);
    }
  }
}

/**
 * Create the staging directory, commit everything as one generic commit, and
 * return its path. The caller owns cleanup.
 */
export function stageRepository(files) {
  const stage = copyFiles(files);

  // `init.templateDir=` and `core.hooksPath=` keep whatever the packer has
  // configured globally (hook samples, templates) out of the candidate's repo.
  execFileSync(
    'git',
    ['-C', stage, '-c', 'init.templateDir=', '-c', 'core.hooksPath=', 'init', '-q', '--initial-branch', DEFAULT_BRANCH],
    { stdio: 'ignore' },
  );
  git(stage, ['config', 'core.autocrlf', 'false']);
  git(stage, ['config', 'commit.gpgsign', 'false']);
  git(stage, ['add', '-A']);

  // Record the executable bit explicitly so it survives a pack run on Windows,
  // where the filesystem cannot express it.
  for (const file of files.filter((candidate) => candidate.isExecutable)) {
    git(stage, ['update-index', '--chmod=+x', file.relPath]);
  }

  // The identity is passed through the environment on purpose: writing user.name
  // into the repository config would make every commit the CANDIDATE later makes
  // appear to be authored by us, destroying the signal their history carries.
  git(stage, ['commit', '-q', '-m', COMMIT_MESSAGE], {
    env: {
      GIT_AUTHOR_NAME: COMMIT_NAME,
      GIT_AUTHOR_EMAIL: COMMIT_EMAIL,
      GIT_AUTHOR_DATE: COMMIT_DATE,
      GIT_COMMITTER_NAME: COMMIT_NAME,
      GIT_COMMITTER_EMAIL: COMMIT_EMAIL,
      GIT_COMMITTER_DATE: COMMIT_DATE,
    },
  });

  // Let each platform decide how to detect the executable bit. A hard-coded
  // core.filemode=true from a Linux pack makes Windows report mode-only
  // differences, which is exactly the dirty-first-status problem this replaces.
  try {
    git(stage, ['config', '--unset', 'core.filemode']);
  } catch {
    // Absent already on some git versions.
  }

  assertStageIsClean(stage);
  return stage;
}

/** Collect every file under the staging directory, including its git metadata. */
export function collectStagedEntries(stage, packFiles) {
  const executable = new Set(packFiles.filter((file) => file.isExecutable).map((file) => file.relPath));
  const { files, warnings } = walkFiles({ root: stage, dir: stage, skip: isVolatileGitPath });
  const entries = files.map((file) => ({
    name: file.relPath,
    sourcePath: file.absPath,
    mode: executable.has(file.relPath) ? 0o755 : 0o644,
    mtime: new Date(COMMIT_DATE),
  }));
  return { entries, warnings };
}

/**
 * Every executable entry must start with `#!`. git-for-windows marks such files
 * executable by heuristic, so this is what keeps a Windows candidate's first
 * `git status` clean; an executable file without a shebang would break it.
 */
export function assertExecutablesHaveShebang(entries) {
  for (const entry of entries.filter((candidate) => (candidate.mode & 0o111) !== 0)) {
    const handle = fs.openSync(entry.sourcePath, 'r');
    try {
      const head = Buffer.alloc(2);
      fs.readSync(handle, head, 0, 2, 0);
      if (head.toString('latin1') !== '#!') {
        throw new Error(
          `${entry.name} is executable but has no "#!" line. Windows candidates would extract a dirty working tree; ` +
            'either give it a shebang or drop its executable bit.',
        );
      }
    } finally {
      fs.closeSync(handle);
    }
  }
}
