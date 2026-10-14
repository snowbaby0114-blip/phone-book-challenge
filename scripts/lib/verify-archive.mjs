// Post-write verification shared by pack and delivery.
//
// Both directions verify by reading the finished archive's central directory
// rather than by trusting the code that wrote it. A failed verification must
// never leave a plausible-looking archive lying around for someone to send.

import fs from 'node:fs';
import { readZipCentralDirectory } from './zip-reader.mjs';
import { isForbiddenPath, formatBytes } from './repo-files.mjs';

export const GIT_HEAD_ENTRY = '.git/HEAD';
export const GIT_OBJECTS_PREFIX = '.git/objects';

/**
 * @param {string} zipPath
 * @param {object} rules
 * @param {string[]} [rules.requiredNames]     Entries that must be present.
 * @param {string[]} [rules.forbiddenNames]    Entries that must be absent.
 * @param {boolean} [rules.rejectForbiddenPaths] Fail on build output / dependencies.
 * @param {Array<{name: string, mode: number}>} [rules.requiredModes] Entries that must carry a mode.
 * @param {boolean} [rules.requireGitObjects] Fail unless real git objects are present.
 * @param {number} [rules.maxBytes]            Size budget for the archive.
 * @returns {{entries: object[], bytes: number, problems: string[]}}
 */
export function verifyArchive(zipPath, rules = {}) {
  const entries = readZipCentralDirectory(zipPath);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const bytes = fs.statSync(zipPath).size;
  const problems = [];

  for (const required of rules.requiredNames ?? []) {
    if (!byName.has(required)) {
      problems.push(
        required === GIT_HEAD_ENTRY
          ? `${required} is missing — the git history was NOT included.`
          : `${required} is missing from the archive.`,
      );
    }
  }

  for (const forbidden of rules.forbiddenNames ?? []) {
    if (byName.has(forbidden)) problems.push(`Internal file leaked into the archive: ${forbidden}`);
  }

  if (rules.rejectForbiddenPaths) {
    for (const entry of entries) {
      if (isForbiddenPath(entry.name)) problems.push(`Build output or dependency leaked: ${entry.name}`);
    }
  }

  for (const { name, mode } of rules.requiredModes ?? []) {
    const entry = byName.get(name);
    if (entry && (entry.mode & mode) !== mode) {
      problems.push(`${name} does not carry mode ${mode.toString(8)} in the archive.`);
    }
  }

  // A git directory without objects is not a repository. A linked worktree's
  // git directory contains only HEAD/index/commondir, so requiring objects stops
  // an archive that carries no recoverable history from passing on HEAD alone.
  if (rules.requireGitObjects) {
    const hasObjects = entries.some((entry) => entry.name.startsWith(`${GIT_OBJECTS_PREFIX}/`));
    if (!hasObjects) {
      problems.push(
        `No git objects found under ${GIT_OBJECTS_PREFIX}/ — the archive carries no usable history.`,
      );
    }
  }

  if (rules.maxBytes !== undefined && bytes > rules.maxBytes) {
    problems.push(`Archive is ${formatBytes(bytes)}, above the ${formatBytes(rules.maxBytes)} budget.`);
  }

  return { entries, bytes, problems };
}

/**
 * Rename a failed archive out of the way. Leaving it under its normal name
 * invites someone to send an archive that failed its own checks.
 */
export function quarantineArchive(zipPath) {
  const quarantined = `${zipPath}.INVALID`;
  try {
    fs.renameSync(zipPath, quarantined);
    return quarantined;
  } catch {
    fs.rmSync(zipPath, { force: true });
    return null;
  }
}
