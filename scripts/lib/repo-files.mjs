// File enumeration for both packaging directions.
//
// Everything here is an ALLOWLIST derived from git, never a denylist of build
// directories. `git ls-files` cannot report an ignored path, so node_modules,
// bin/, obj/, .angular and the Postgres data directory are structurally
// impossible to ship — including any build directory added in the future that
// nobody remembered to add to a script.

import fs from 'node:fs';
import path from 'node:path';
import { git, gitZ, dirtyPaths } from './git.mjs';
import { walkFiles, describeFile } from './fs-walk.mjs';

/** Internal files that must never reach a candidate. */
export const INTERNAL_ONLY = [
  'EVALUATE.md',
  'README_INTERNAL.md',
  'scripts/pack.mjs',
  'scripts/pack.sh',
  'scripts/pack.ps1',
];

/** Where git metadata is stored inside an archive, whatever its real location. */
export const GIT_DIR_PREFIX = '.git';

/** Paths that indicate build output or dependencies leaked into an archive. */
const FORBIDDEN_RE =
  /(^|\/)(node_modules|bin|obj|dist|\.angular)(\/|$)|^\.docker\/postgres\/data(\/|$)/;

/** OS/editor noise, and the archives these scripts themselves generate. */
const JUNK_RE = /(^|\/)(\.DS_Store|Thumbs\.db)$/i;
const GENERATED_ARCHIVE_RE = /^[^/]+\.zip(\.INVALID|\.tmp)?$/i;

/** Volatile git internals that should not be captured mid-operation. */
const GIT_SKIP_RE = /(^|\/)(.*\.lock|COMMIT_EDITMSG|MERGE_MSG|TAG_EDITMSG)$|(^|\/)objects\/tmp_/;

const GIT_MODE_SYMLINK = '120000';
const GIT_MODE_GITLINK = '160000';
const GIT_MODE_EXEC = '100755';

/** True when the path looks like build output or a dependency directory. */
export function isForbiddenPath(relPath) {
  return FORBIDDEN_RE.test(relPath);
}

/** True for volatile git internals that must not be archived. */
export function isVolatileGitPath(relPath) {
  return GIT_SKIP_RE.test(relPath);
}

/**
 * Tracked files only, for the outbound candidate package, with the mode git
 * records rather than the mode this filesystem happens to report. Windows
 * cannot represent the executable bit, so trusting git keeps `delivery.sh`
 * executable no matter where the package was built.
 */
export function listPackFiles(root) {
  const records = gitZ(root, ['ls-files', '-s', '-z']);
  const files = [];
  const warnings = [];

  for (const record of records) {
    const tabIndex = record.indexOf('\t');
    if (tabIndex === -1) continue;
    const mode = record.slice(0, record.indexOf(' '));
    const relPath = record.slice(tabIndex + 1);

    if (INTERNAL_ONLY.includes(relPath)) continue;
    if (mode === GIT_MODE_GITLINK) {
      warnings.push(`Skipped submodule ${relPath} (submodules are not supported in the package).`);
      continue;
    }
    if (mode === GIT_MODE_SYMLINK) {
      warnings.push(`Skipped symlink ${relPath} (symlinks do not survive extraction on Windows).`);
      continue;
    }
    const absPath = path.join(root, relPath);
    if (!fs.existsSync(absPath)) {
      warnings.push(`Tracked file missing from the working tree: ${relPath}`);
      continue;
    }

    files.push({ ...describeFile(relPath, absPath), mode: mode === GIT_MODE_EXEC ? 0o755 : 0o644, isExecutable: mode === GIT_MODE_EXEC });
  }

  return { files, warnings };
}

/**
 * Locate the real git directory.
 *
 * `<root>/.git` is a plain directory in the common case, but it is a FILE
 * holding a `gitdir:` pointer inside a linked worktree, a submodule, or a repo
 * created with --separate-git-dir. Asking git avoids silently shipping an
 * archive with no history in those layouts.
 *
 * A LINKED WORKTREE is the dangerous case: its git directory holds only HEAD,
 * index and a `commondir` pointer — the objects and refs live in the main
 * repository — so archiving it alone yields something that is not a repository
 * at all.
 *
 * @returns {{gitDir: string, commonDir: string, isLinkedWorktree: boolean}|null}
 */
export function resolveGitDir(root) {
  try {
    const gitDir = git(root, ['rev-parse', '--absolute-git-dir']);
    const commonDir = path.resolve(root, git(root, ['rev-parse', '--git-common-dir']));
    return { gitDir, commonDir, isLinkedWorktree: path.resolve(gitDir) !== commonDir };
  } catch {
    return null;
  }
}

/**
 * Everything a candidate should submit: tracked files, untracked-but-not-ignored
 * files (so work in progress is never lost), and the whole git directory (so
 * their commit history arrives intact — the old PowerShell script silently
 * dropped it because that directory is hidden on Windows).
 */
export function listDeliveryFiles(root) {
  const warnings = [];
  const byPath = new Map();

  for (const relPath of gitZ(root, ['ls-files', '-c', '-o', '--exclude-standard', '-z'])) {
    if (GENERATED_ARCHIVE_RE.test(relPath)) continue;
    if (JUNK_RE.test(relPath)) {
      warnings.push(`Excluded ${relPath} (operating-system metadata, not part of your work).`);
      continue;
    }
    const absPath = path.join(root, relPath);
    let stat;
    try {
      stat = fs.lstatSync(absPath);
    } catch {
      // Tracked but deleted in the working tree; the deletion is preserved in git.
      continue;
    }
    if (stat.isSymbolicLink()) {
      warnings.push(`Skipped symlink ${relPath}.`);
      continue;
    }
    if (!stat.isFile()) continue;
    byPath.set(relPath, describeFile(relPath, absPath));
  }

  const resolved = resolveGitDir(root);
  if (resolved !== null && resolved.isLinkedWorktree) {
    // Refusing beats shipping a stub: this directory has no objects or refs, so
    // the archive would extract to something git does not recognise at all.
    throw new Error(
      `${root} is a linked git worktree, whose history lives in the main working tree instead.\n` +
        `Please run this script from ${path.dirname(resolved.commonDir)} so your commits are included.\n` +
        'Run `git worktree list` to see all of your working trees.',
    );
  }
  if (resolved !== null && fs.existsSync(resolved.gitDir)) {
    // Always archived under `.git/`, even when the real directory lives
    // elsewhere, so the extracted copy is an ordinary standalone repository.
    const walked = walkFiles({
      root: resolved.gitDir,
      dir: resolved.gitDir,
      prefix: GIT_DIR_PREFIX,
      skip: isVolatileGitPath,
    });
    for (const file of walked.files) byPath.set(file.relPath, file);
    warnings.push(...walked.warnings);
    if (path.basename(resolved.gitDir) !== GIT_DIR_PREFIX) {
      warnings.push(`Git metadata was read from ${resolved.gitDir} and stored as ${GIT_DIR_PREFIX}/ in the archive.`);
    }
  } else {
    warnings.push('No git metadata found — your commit history will NOT be included.');
  }

  return { files: [...byPath.values()], warnings };
}

/** Human-facing summary used to warn before an archive is produced. */
export function buildSafetyReport(root, files) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 10);
  const forbidden = files.filter((file) => isForbiddenPath(file.relPath));

  let uncommittedCount = 0;
  try {
    uncommittedCount = dirtyPaths(root).length;
  } catch {
    uncommittedCount = -1;
  }

  return { totalBytes, fileCount: files.length, largest, forbidden, uncommittedCount };
}

/** Format a byte count for display. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
