// ZIP format constants and pure helpers, shared by the writer and the reader so
// the two cannot drift apart on a signature or an offset.
//
// Scope note: store + deflate, no ZIP64, no encryption.

export const LOCAL_SIG = 0x04034b50;
export const CENTRAL_SIG = 0x02014b50;
export const EOCD_SIG = 0x06054b50;

export const METHOD_STORE = 0;
export const METHOD_DEFLATE = 8;

export const FLAG_UTF8 = 0x0800;
export const VERSION_NEEDED = 20;
// Upper byte 0x03 = UNIX, so the external attributes carry st_mode and `unzip`
// restores the executable bit on scripts/*.sh.
export const VERSION_MADE_BY_UNIX = 0x031e;

export const LOCAL_HEADER_SIZE = 30;
export const CENTRAL_HEADER_SIZE = 46;
export const EOCD_SIZE = 22;

const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;

/** Entry-count and per-entry/total size ceilings before ZIP64 would be required. */
export const MAX_ENTRIES = 0xffff;
export const MAX_SIZE = 0xffffffff;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/** CRC-32 (implemented locally: zlib.crc32 only exists on Node >= 20.15). */
export function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

/** Convert a Date to the MS-DOS date/time pair ZIP uses (2-second precision). */
export function dosDateTime(date) {
  const year = date.getUTCFullYear();
  if (year < 1980) return { dosTime: 0, dosDate: (1 << 5) | 1 };
  return {
    dosTime:
      (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/**
 * Normalise an entry name to a safe, forward-slashed, relative POSIX path.
 * Rejects anything that could escape the extraction directory.
 *
 * Both separators are treated as separators regardless of host platform: a
 * backslash is a path separator to Windows extraction tools, so `..\..\evil`
 * must be rejected even when this runs on Linux.
 */
export function normalizeEntryName(name) {
  // Absolute names are rejected rather than quietly relativised: no caller here
  // produces one, so an absolute name means a bug worth surfacing.
  if (/^[a-zA-Z]:/.test(name) || /^[/\\]/.test(name)) {
    throw new Error(`Refusing absolute zip entry name: ${name}`);
  }
  const segments = name.split(/[/\\]/).filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) throw new Error(`Zip entry name is empty: ${JSON.stringify(name)}`);
  if (segments.includes('..')) throw new Error(`Refusing zip entry name containing "..": ${name}`);
  return segments.join('/');
}

/** External attributes field: Unix st_mode in the high 16 bits. */
export function externalAttributes(mode, isDirectory) {
  const permissions = mode & 0o7777;
  const fullMode = (isDirectory ? S_IFDIR : S_IFREG) | permissions;
  // Multiply rather than shift: `fullMode << 16` is negative in JavaScript's
  // 32-bit signed bitwise arithmetic, which makes writeUInt32LE throw.
  return (fullMode * 0x10000) >>> 0;
}
