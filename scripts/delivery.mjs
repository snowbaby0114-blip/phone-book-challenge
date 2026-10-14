#!/usr/bin/env node
// Packages your work for submission.
//
// The archive contains your project files AND your git history, so the commits
// you made reach us intact. Dependencies and build output (node_modules, bin,
// obj, .angular, dist) are excluded automatically because the file list comes
// from git and respects .gitignore.
//
// Usage: node scripts/delivery.mjs [--name="Your Name"]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, isGitRepo, assertGitAvailable } from './lib/git.mjs';
import { listDeliveryFiles, buildSafetyReport, formatBytes, GIT_DIR_PREFIX } from './lib/repo-files.mjs';
import { writeZip } from './lib/zip-writer.mjs';
import { verifyArchive, quarantineArchive, GIT_HEAD_ENTRY } from './lib/verify-archive.mjs';
import { getFlag, assertKnownFlags, askRequired } from './lib/prompt.mjs';

const SUBMISSION_EMAIL = 'tech.challenge@eyecarepro.net';
const LARGE_FILE_BYTES = 5 * 1024 * 1024;
const KNOWN_FLAGS = ['name'];

// Resolved from this file's own location, so the script behaves identically
// whether you run it from the repository root or from inside scripts/.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** "José da Silva" -> "jose-da-silva" */
function slugify(name) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'candidate' : slug;
}

/** Local timestamp, sortable — unlike the epoch seconds used previously. */
function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function printReport(report, warnings) {
  console.log('');
  console.log(`  Files to include   ${report.fileCount}`);
  console.log(`  Uncompressed size  ${formatBytes(report.totalBytes)}`);
  console.log('');

  for (const warning of warnings) console.log(`  ! ${warning}`);

  if (report.uncommittedCount > 0) {
    console.log(`  ! ${report.uncommittedCount} uncommitted change(s) will be included as loose files.`);
    console.log('    They are part of your submission, but committing them tells us more');
    console.log('    about how you worked. Either way, we continue.');
  }

  if (report.forbidden.length > 0) {
    console.log(`  ! ${report.forbidden.length} path(s) look like dependencies or build output:`);
    for (const file of report.forbidden.slice(0, 10)) {
      console.log(`      ${file.relPath} (${formatBytes(file.size)})`);
    }
    console.log('    These are normally excluded automatically; they are present because');
    console.log('    they were force-added to git. Remove them if that was accidental.');
  }

  const large = report.largest.filter((file) => file.size >= LARGE_FILE_BYTES);
  if (large.length > 0) {
    console.log('  ! Largest files:');
    for (const file of large) console.log(`      ${file.relPath} (${formatBytes(file.size)})`);
  }
  if (warnings.length > 0 || report.forbidden.length > 0 || large.length > 0 || report.uncommittedCount > 0) {
    console.log('');
  }
}

async function main() {
  const argv = process.argv.slice(2);
  assertKnownFlags(argv, KNOWN_FLAGS);
  assertGitAvailable();
  if (!isGitRepo(repoRoot)) {
    throw new Error(`${repoRoot} is not a git repository. Run this script from inside the challenge project.`);
  }

  const providedName = getFlag(argv, 'name');
  const candidateName = providedName || (await askRequired('What is your name?'));
  const slug = slugify(candidateName);

  console.log('');
  console.log(`${candidateName}, thanks for participating in our tests!`);
  console.log('Building your submission archive...');

  const { files, warnings } = listDeliveryFiles(repoRoot);
  const report = buildSafetyReport(repoRoot, files);
  printReport(report, warnings);

  const zipName = `${slug}_delivery_${timestamp()}.zip`;
  const zipPath = path.join(repoRoot, zipName);
  const written = writeZip({
    outPath: zipPath,
    entries: files.map((file) => ({
      name: file.relPath,
      sourcePath: file.absPath,
      mode: file.mode,
      mtime: file.mtime,
    })),
  });

  const { entries, bytes, problems } = verifyArchive(zipPath, {
    requiredNames: [GIT_HEAD_ENTRY, 'README.md'],
    requireGitObjects: true,
  });

  // Verify BEFORE reporting. Printing a commit count next to an archive that
  // failed its own history check is how a candidate ends up confident they sent
  // work they did not send.
  if (problems.length > 0) {
    const quarantined = quarantineArchive(zipPath);
    console.error('Verification FAILED — this archive is NOT safe to send:');
    for (const problem of problems) console.error(`  - ${problem}`);
    if (quarantined) console.error(`\nThe archive was renamed to ${path.basename(quarantined)} so it is not sent by mistake.`);
    console.error(`Please email ${SUBMISSION_EMAIL} and we will sort out another way to receive your work.\n`);
    process.exitCode = 1;
    return;
  }

  // Safe to quote the live repository now: verification proved the git
  // metadata is in the archive, so the two cannot disagree.
  let commitSummary = 'included';
  try {
    commitSummary = `${Number(git(repoRoot, ['rev-list', '--count', 'HEAD']))} commit(s)`;
  } catch {
    commitSummary = 'no commits yet';
  }
  const historyEntries = entries.filter((entry) => entry.name.startsWith(`${GIT_DIR_PREFIX}/`)).length;

  console.log(`  Archive   ${zipPath}`);
  console.log(`  Entries   ${written.entryCount}`);
  console.log(`  Size      ${formatBytes(bytes)}`);
  console.log(`  History   ${commitSummary}, ${historyEntries} git metadata file(s)`);
  console.log('');

  console.log(`Your delivery is ready. Attach ${zipName} to your reply to ${SUBMISSION_EMAIL}.`);
  console.log('');
}

main().catch((error) => {
  console.error(`\nCould not build your delivery: ${error.message}\n`);
  process.exitCode = 1;
});
