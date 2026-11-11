/**
 * Reading a dsh Session log.
 *
 * Three shapes carry a session: a concatenated Zstandard log, a plain JSONL
 * log, and a ZIP exported from the Session log export. All three decode to the
 * same event stream.
 * @module dsh-enhance/session-unpack/log
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { decodeZstdFrames } from './frames.js'
import { findExportedLogEntry, readZipEntry } from './zip.js'

/**
 * Split a decoded log into its header and its events.
 * @param text - the decoded log text.
 * @param sourcePath - where the log came from, for the report.
 * @returns the parsed log.
 */
export function parseSessionLog(text, sourcePath) {
  const lines = text.split('\n').filter(line => line.trim() !== '')
  let header
  let cursor = 0
  if (lines.length > 0) {
    const first = tryParse(lines[0])
    if (first !== undefined && first.type === 'session') {
      header = first
      cursor = 1
    }
  }
  const events = []
  for (let index = cursor; index < lines.length; index += 1) {
    const parsed = tryParse(lines[index])
    if (parsed !== undefined) events.push(parsed)
  }
  return { header, events, text, sourcePath }
}

/**
 * Parse one JSON line, tolerating a line that is not JSON.
 * @param line - the line to parse.
 * @returns the parsed object, or undefined.
 */
function tryParse(line) {
  try {
    const parsed = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * Read one session artifact and decode it into its event stream.
 *
 * The file is read and decoded off the event loop, and the signal is observed
 * while the frames are decoded, so a long log does not keep the Host busy and
 * an aborted call stops as soon as the current frame is done.
 * @param path - the `.jsonl`, `.jsonl.zstd` or `.zip` artifact.
 * @param signal - the cancellation signal of the running call.
 * @returns the decoded log.
 */
export async function readSessionLog(path, signal) {
  const absolute = resolve(path)
  let bytes
  try {
    bytes = await readFile(absolute)
  } catch (failure) {
    if (failure?.code === 'ENOENT') throw new Error(`no such session artifact: ${absolute}`)
    throw failure
  }
  signal?.throwIfAborted()
  let text
  if (absolute.endsWith('.zip')) {
    const wanted = findExportedLogEntry(bytes)
    const entry = await readZipEntry(bytes, wanted)
    if (entry === undefined) throw new Error(`not a session archive: ${absolute} holds no readable ${wanted}`)
    text = entry.toString('utf8')
  } else if (absolute.endsWith('.zstd')) {
    text = (await decodeZstdFrames(bytes, signal)).toString('utf8')
  } else {
    text = bytes.toString('utf8')
  }
  return parseSessionLog(text, absolute)
}
