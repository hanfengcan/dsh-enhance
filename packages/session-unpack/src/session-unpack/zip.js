/**
 * ZIP archives of exported dsh Session logs.
 *
 * An exported session is a ZIP whose root holds the canonical
 * `session.v<version>.jsonl` text plus the attachments it references. The
 * archive is read with Node's own zlib, one entry at a time.
 *
 * A ZIP that was assembled by hand — the session folder zipped as it sits on
 * disk — holds the compressed log instead (`session.v<version>.jsonl.zstd`),
 * so that shape is read as well.
 * @module dsh-enhance/session-unpack/zip
 */

import { basename } from 'node:path'
import { inflateRaw } from 'node:zlib'
import { promisify } from 'node:util'

/** Signature of a ZIP end-of-central-directory record. */
const ZIP_EOCD_SIGNATURE = 0x06054b50

/** Signature of a ZIP central-directory file header. */
const ZIP_CENTRAL_SIGNATURE = 0x02014b50

/** Signature of a ZIP local file header. */
const ZIP_LOCAL_SIGNATURE = 0x04034b50

/** The canonical log filename a Session export puts in a ZIP root. */
const EXPORTED_LOG_PATTERN = /^session(\.v\d+)?\.jsonl(\.zstd)?$/

/** The asynchronous form of zlib's raw inflate. */
const inflateRawAsync = promisify(inflateRaw)

/**
 * Where the end-of-central-directory record sits.
 * @param buffer - the archive bytes.
 * @returns the record's offset.
 */
function findEocd(buffer) {
  const floor = Math.max(0, buffer.length - 0x10000 - 22)
  for (let offset = buffer.length - 22; offset >= floor; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset
  }
  throw new Error('not a ZIP archive: no end-of-central-directory record')
}

/**
 * The names of the entries a ZIP archive holds.
 * @param buffer - the archive bytes.
 * @returns every entry name, in the order the central directory lists them.
 */
export function listZipEntries(buffer) {
  const eocd = findEocd(buffer)
  const entryCount = buffer.readUInt16LE(eocd + 10)
  const directoryOffset = buffer.readUInt32LE(eocd + 16)
  if (directoryOffset === 0xFFFFFFFF) throw new Error('not a supported ZIP archive: ZIP64 archives are not read')
  const names = []
  let cursor = directoryOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) break
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    names.push(buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return names
}

/**
 * The name of the session log an exported archive holds.
 *
 * When the archive holds more than one generation of the log, the newest one
 * wins — and a compressed log is ahead of its plain twin, the same order the
 * on-disk lookup uses.
 * @param buffer - the archive bytes.
 * @returns the entry name of the session log.
 */
export function findExportedLogEntry(buffer) {
  const matches = listZipEntries(buffer).filter(name => EXPORTED_LOG_PATTERN.test(basename(name)))
  if (matches.length === 0) throw new Error('not a session archive: it holds no session log')
  return matches.sort(compareLogEntries)[0]
}

/**
 * Order two log entry names so the newest generation wins.
 * @param left - one entry name.
 * @param right - the other entry name.
 * @returns a negative number when `left` is the newer generation.
 */
function compareLogEntries(left, right) {
  const version = name => {
    const matched = /\.v(\d+)\.jsonl/.exec(name)
    return matched === null ? 0 : Number(matched[1])
  }
  const difference = version(right) - version(left)
  if (difference !== 0) return difference
  // A compressed log is the current default; keep it ahead of its plain twin.
  return (right.endsWith('.zstd') ? 1 : 0) - (left.endsWith('.zstd') ? 1 : 0)
}

/**
 * Read one entry out of a ZIP archive.
 * @param buffer - the archive bytes.
 * @param wanted - the entry name to read.
 * @returns the entry's bytes, or undefined when the archive has no such entry.
 */
export async function readZipEntry(buffer, wanted) {
  const eocd = findEocd(buffer)
  const entryCount = buffer.readUInt16LE(eocd + 10)
  let cursor = buffer.readUInt32LE(eocd + 16)
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) break
    const method = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    cursor += 46 + nameLength + extraLength + commentLength
    if (name !== wanted) continue
    if (compressedSize === 0xFFFFFFFF) throw new Error('not a supported ZIP archive: ZIP64 entries are not read')
    if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_SIGNATURE) {
      throw new Error(`not a supported ZIP archive: bad local header for ${name}`)
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) return Buffer.from(data)
    if (method === 8) return await inflateRawAsync(data)
    throw new Error(`not a supported ZIP archive: entry ${name} uses compression method ${method}`)
  }
  return undefined
}
