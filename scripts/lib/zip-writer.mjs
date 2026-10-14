// Minimal, dependency-free ZIP writer.
//
// Why hand-rolled: the packaging scripts must run identically on Linux, macOS
// and Windows with nothing installed beyond Node and git. `zip` does not exist
// on Windows, GNU tar cannot write zip archives, and PowerShell's
// Compress-Archive flattens directory structure and drops Unix permission bits.
// Node's built-in zlib gives us everything the ZIP format actually needs.
//
// Format constants and pure helpers live in ./zip-format.mjs; reading archives
// back lives in ./zip-reader.mjs.

import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  LOCAL_SIG,
  CENTRAL_SIG,
  EOCD_SIG,
  METHOD_STORE,
  METHOD_DEFLATE,
  FLAG_UTF8,
  VERSION_NEEDED,
  VERSION_MADE_BY_UNIX,
  LOCAL_HEADER_SIZE,
  CENTRAL_HEADER_SIZE,
  EOCD_SIZE,
  MAX_ENTRIES,
  MAX_SIZE,
  crc32,
  dosDateTime,
  normalizeEntryName,
  externalAttributes,
} from './zip-format.mjs';

/**
 * Write a ZIP archive.
 *
 * Writes to a temporary sibling and renames on success, so a failure part-way
 * through cannot leave a truncated file that still carries the ZIP magic number
 * where a valid archive used to be.
 *
 * @param {object} options
 * @param {string} options.outPath  Destination file.
 * @param {Array<{name: string, data?: Buffer, sourcePath?: string, mode?: number,
 *                mtime?: Date, isDirectory?: boolean}>} options.entries
 *        A name ending in `/` or an explicit `isDirectory: true` marks a directory
 *        entry; anything else needs `data` or `sourcePath`.
 * @returns {{bytes: number, entryCount: number}}
 */
export function writeZip({ outPath, entries }) {
  if (entries.length > MAX_ENTRIES) {
    throw new Error(
      `This archive would hold ${entries.length} entries, above the ${MAX_ENTRIES} limit.\n` +
        'Running `git gc` collapses loose git objects into a single pack file and normally fixes this.',
    );
  }

  // Normalise once, then sort on the result: a comparator that recomputed the
  // name on every comparison would be both slow and inconsistent for equal keys.
  //
  // Directory intent is captured BEFORE normalising, because normalisation drops
  // the trailing separator — testing `name.endsWith('/')` afterwards can never be
  // true, so `{ name: 'docs/' }` would otherwise be treated as a file and the
  // writer would try to read an undefined source path.
  const prepared = entries
    .map((entry) => ({
      ...entry,
      isDirectory: Boolean(entry.isDirectory) || /[/\\]$/.test(entry.name),
      name: normalizeEntryName(entry.name),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const tmpPath = `${outPath}.tmp`;
  const central = [];
  let offset = 0;
  const fd = fs.openSync(tmpPath, 'w');

  const write = (buf) => {
    let written = 0;
    while (written < buf.length) written += fs.writeSync(fd, buf, written);
    offset += buf.length;
    if (offset > MAX_SIZE) {
      throw new Error(
        'This archive has passed the 4 GiB limit this writer supports.\n' +
          'Remove large files from the project (build output and dependencies are excluded automatically) and try again.',
      );
    }
  };

  try {
    for (const entry of prepared) {
      const isDirectory = entry.isDirectory;
      const storedName = isDirectory ? `${entry.name}/` : entry.name;
      const nameBuf = Buffer.from(storedName, 'utf8');
      const mode = entry.mode ?? (isDirectory ? 0o755 : 0o644);
      const { dosTime, dosDate } = dosDateTime(entry.mtime ?? new Date(0));

      let raw = Buffer.alloc(0);
      if (!isDirectory) {
        raw = entry.data ?? fs.readFileSync(entry.sourcePath);
        if (raw.length > MAX_SIZE) {
          throw new Error(`${entry.name} is larger than 4 GiB, which this writer cannot store.`);
        }
      }

      let method = METHOD_STORE;
      let payload = raw;
      if (raw.length > 0) {
        const deflated = zlib.deflateRawSync(raw, { level: 9 });
        // Only pay the deflate overhead when it actually saves space.
        if (deflated.length < raw.length) {
          method = METHOD_DEFLATE;
          payload = deflated;
        }
      }

      const crc = raw.length === 0 ? 0 : crc32(raw);
      const localOffset = offset;

      const local = Buffer.alloc(LOCAL_HEADER_SIZE);
      local.writeUInt32LE(LOCAL_SIG, 0);
      local.writeUInt16LE(VERSION_NEEDED, 4);
      local.writeUInt16LE(FLAG_UTF8, 6);
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(dosTime, 10);
      local.writeUInt16LE(dosDate, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(raw.length, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      local.writeUInt16LE(0, 28);
      write(local);
      write(nameBuf);
      if (payload.length > 0) write(payload);

      const centralEntry = Buffer.alloc(CENTRAL_HEADER_SIZE);
      centralEntry.writeUInt32LE(CENTRAL_SIG, 0);
      centralEntry.writeUInt16LE(VERSION_MADE_BY_UNIX, 4);
      centralEntry.writeUInt16LE(VERSION_NEEDED, 6);
      centralEntry.writeUInt16LE(FLAG_UTF8, 8);
      centralEntry.writeUInt16LE(method, 10);
      centralEntry.writeUInt16LE(dosTime, 12);
      centralEntry.writeUInt16LE(dosDate, 14);
      centralEntry.writeUInt32LE(crc, 16);
      centralEntry.writeUInt32LE(payload.length, 20);
      centralEntry.writeUInt32LE(raw.length, 24);
      centralEntry.writeUInt16LE(nameBuf.length, 28);
      centralEntry.writeUInt16LE(0, 30);
      centralEntry.writeUInt16LE(0, 32);
      centralEntry.writeUInt16LE(0, 34);
      centralEntry.writeUInt16LE(0, 36);
      centralEntry.writeUInt32LE(externalAttributes(mode, isDirectory), 38);
      centralEntry.writeUInt32LE(localOffset, 42);
      central.push(Buffer.concat([centralEntry, nameBuf]));
    }

    const centralOffset = offset;
    for (const buf of central) write(buf);
    const centralSize = offset - centralOffset;

    const eocd = Buffer.alloc(EOCD_SIZE);
    eocd.writeUInt32LE(EOCD_SIG, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(central.length, 8);
    eocd.writeUInt16LE(central.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralOffset, 16);
    eocd.writeUInt16LE(0, 20);
    write(eocd);
    fs.closeSync(fd);
    fs.renameSync(tmpPath, outPath);
  } catch (error) {
    try {
      fs.closeSync(fd);
    } catch {
      // Already closed on the success path.
    }
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }

  return { bytes: offset, entryCount: central.length };
}
