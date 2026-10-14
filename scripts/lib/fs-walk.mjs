// Shared directory walk used by both packaging directions.
//
// Iterative rather than recursive so a deep tree cannot blow the stack, and
// symlinks are reported rather than followed: they do not survive extraction on
// Windows and following them could pull in content from outside the project.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Walk `absDir`, returning one record per regular file.
 *
 * @param {object} options
 * @param {string} options.root      Base directory that returned paths are relative to.
 * @param {string} options.dir       Directory to walk (may equal `root`).
 * @param {(relPath: string) => boolean} [options.skip]  Return true to skip a path.
 * @param {string} [options.prefix]  Prepended to returned relative paths.
 * @returns {{files: Array<{relPath: string, absPath: string, mode: number,
 *            isExecutable: boolean, size: number, mtime: Date}>, warnings: string[]}}
 */
export function walkFiles({ root, dir, skip, prefix = '' }) {
  const files = [];
  const warnings = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const dirent of fs.readdirSync(current, { withFileTypes: true })) {
      const absPath = path.join(current, dirent.name);
      const relative = path.relative(root, absPath).split(path.sep).join('/');
      const relPath = prefix === '' ? relative : `${prefix}/${relative}`;

      if (skip && skip(relPath)) continue;

      if (dirent.isSymbolicLink()) {
        warnings.push(`Skipped symlink ${relPath}.`);
      } else if (dirent.isDirectory()) {
        stack.push(absPath);
      } else if (dirent.isFile()) {
        files.push(describeFile(relPath, absPath));
      }
    }
  }

  return { files, warnings };
}

/** Metadata captured once, so nothing needs a second stat() later. */
export function describeFile(relPath, absPath) {
  const stat = fs.statSync(absPath);
  return {
    relPath,
    absPath,
    mode: stat.mode & 0o111 ? 0o755 : 0o644,
    isExecutable: Boolean(stat.mode & 0o111),
    size: stat.size,
    mtime: stat.mtime,
  };
}
