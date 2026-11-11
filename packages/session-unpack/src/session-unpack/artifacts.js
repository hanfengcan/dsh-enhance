/**
 * The artifacts one unpacked Session is made of.
 *
 * A Session unpacks into a directory that holds three files: `transcript.md`
 * (the conversation as Markdown), `session.jsonl` (the raw event stream) and
 * `meta.json` (the session metadata). The event stream always holds the whole
 * session; only the transcript is cut down to the exported turns.
 * @module dsh-enhance/session-unpack/artifacts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import { readSessionLog } from './log.js'
import { resolveArtifactPath } from './paths.js'
import { collectTurns, findAnchor, renderTranscript, sessionTitle } from './transcript.js'

/**
 * Unpack one Session into a directory with a transcript, the raw event stream
 * and the metadata.
 *
 * Every step is awaited, so the Host keeps serving while a long session is
 * unpacked, and the signal is observed between the steps.
 * @param request - what to read and where to write.
 * @param signal - the cancellation signal of the running call.
 * @returns the unpack result.
 */
export async function unpackSession(request, signal) {
  const source = resolve(request.source)
  const logPath = request.logPath ?? resolveArtifactPath(source, request.session)
  const log = await readSessionLog(logPath, signal)
  signal?.throwIfAborted()
  const sessionId = typeof log.header?.id === 'string'
    ? log.header.id
    : (request.session ?? basename(dirname(logPath)))
  const turns = await collectTurns(log.events, signal)
  const anchor = request.from === undefined ? undefined : findAnchor(turns, request.from)
  const fromTurn = anchor === undefined ? undefined : anchor.turn
  const outputPath = resolve(request.outputPath ?? join(tmpdir(), 'dsh-session-unpack', sessionId))
  const transcript = await renderTranscript(log, { fromTurn, maxTurns: request.maxTurns }, signal)
  signal?.throwIfAborted()
  await mkdir(outputPath, { recursive: true })
  const transcriptPath = join(outputPath, 'transcript.md')
  const eventsPath = join(outputPath, 'session.jsonl')
  const metaPath = join(outputPath, 'meta.json')
  await writeFile(transcriptPath, transcript, 'utf8')
  await writeFile(eventsPath, log.text, 'utf8')
  const meta = {
    sessionId,
    title: sessionTitle(log),
    sourcePath: logPath,
    header: log.header,
    events: log.events.length,
    turns: turns.length,
    fromTurn: fromTurn === undefined ? undefined : fromTurn + 1,
    anchor: request.from,
    files: ['transcript.md', 'session.jsonl', 'meta.json'],
    unpackedAt: new Date().toISOString(),
  }
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  return {
    sessionId,
    title: meta.title,
    sourcePath: logPath,
    outputPath,
    files: meta.files,
    turns: turns.length,
    events: log.events.length,
    fromTurn: meta.fromTurn,
    anchor: request.from,
  }
}
