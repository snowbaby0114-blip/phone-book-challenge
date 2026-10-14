// Reads a ZIP central directory, so a script can verify the archive it just
// produced by inspecting the artefact rather than trusting the code that wrote
// it.
//
// Only the tail and the central directory are read, never the whole file: a
// large submission would otherwise hit ERR_FS_FILE_TOO_LARGE *after* the archive
// was already written, leaving the candidate an opaque error next to a finished
// file.

import fs from 'node:fs';
import { CENTRAL_SIG, EOCD_SIG, EOCD_SIZE, CENTRAL_HEADER_SIZE } from './zip-format.mjs';

const EOCD_MIN_SIZE = EOCD_SIZE;
// The end-of-central-directory record may be followed by a comment of up to
// 64 KiB, so that is how far back we search for its signature.
const EOCD_SEARCH_WINDOW = 64 * 1024 + EOCD_MIN_SIZE;

/** Read `length` bytes from `position` without loading the whole file. */
function readRange(fd, position, length) {
  const buffer = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const chunk = fs.readSync(fd, buffer, read, length - read, position + read);
    if (chunk === 0) break;
    read += chunk;
  }
  return read === length ? buffer : buffer.subarray(0, read);
}

/**
 * Central-directory entries of `zipPath`.
 * @returns {Array<{name: string, size: number, compressedSize: number,
 *                  crc: number, method: number, mode: number}>}
 */
export function readZipCentralDirectory(zipPath) {
  const totalBytes = fs.statSync(zipPath).size;
  if (totalBytes < EOCD_MIN_SIZE) {
    throw new Error(`${zipPath} is too small to be a zip archive.`);
  }

  const fd = fs.openSync(zipPath, 'r');
  try {
    const tailLength = Math.min(EOCD_SEARCH_WINDOW, totalBytes);
    const tail = readRange(fd, totalBytes - tailLength, tailLength);

    let eocd = -1;
    for (let i = tail.length - EOCD_MIN_SIZE; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) {
      throw new Error(`${zipPath} is not a valid zip archive (no end-of-central-directory record).`);
    }

    const count = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    const central = readRange(fd, centralOffset, centralSize);
    if (central.length !== centralSize) {
      throw new Error(`${zipPath} has a truncated central directory.`);
    }

    const entries = [];
    let pointer = 0;
    for (let i = 0; i < count; i++) {
      if (central.readUInt32LE(pointer) !== CENTRAL_SIG) {
        throw new Error(`${zipPath} has a corrupt central directory at entry ${i}.`);
      }
      const nameLength = central.readUInt16LE(pointer + 28);
      const extraLength = central.readUInt16LE(pointer + 30);
      const commentLength = central.readUInt16LE(pointer + 32);
      const externalAttrs = central.readUInt32LE(pointer + 38);
      entries.push({
        name: central.toString('utf8', pointer + CENTRAL_HEADER_SIZE, pointer + CENTRAL_HEADER_SIZE + nameLength),
        crc: central.readUInt32LE(pointer + 16),
        compressedSize: central.readUInt32LE(pointer + 20),
        size: central.readUInt32LE(pointer + 24),
        method: central.readUInt16LE(pointer + 10),
        mode: (externalAttrs >>> 16) & 0o7777,
      });
      pointer += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
    }

    return entries;
  } finally {
    fs.closeSync(fd);
  }
}
