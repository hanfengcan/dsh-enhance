/**
 * Where a dsh Session lives on disk.
 *
 * A dsh Session lives under a home directory as
 * `<home>/sessions/<workspace-slug>/<session-id>/session.v<version>.jsonl.zstd`.
 * The paths are resolved without reading any content, so a caller can ask the
 * user for permission before the artifact is touched.
 * @module dsh-enhance/session-unpack/paths
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * The home directory of a dsh installation or of a dsh home itself.
 * @param source - the path the caller named.
 * @returns the directory that owns a `sessions` folder.
 */
export function resolveSessionHome(source) {
  const base = resolve(source)
  const candidates = [base, join(base, 'home')]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'sessions'))) return candidate
  }
  throw new Error(`no dsh session home at ${base}: expected a "sessions" folder there or under "home"`)
}

/**
 * The Session log file of one session id inside a home directory.
 * @param home - the directory that owns a `sessions` folder.
 * @param sessionId - the session id to find.
 * @returns the log file path.
 */
export function resolveSessionLogPath(home, sessionId) {
  const sessionsRoot = join(home, 'sessions')
  const directories = [join(sessionsRoot, sessionId)]
  for (const entry of readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) directories.push(join(sessionsRoot, entry.name, sessionId))
  }
  for (const directory of directories) {
    if (!existsSync(directory)) continue
    const files = readdirSync(directory)
      .filter(name => /^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(name))
      .sort(compareLogNames)
    if (files.length > 0) return join(directory, files[0])
  }
  throw new Error(`no session log for ${sessionId} under ${sessionsRoot}`)
}

/**
 * Order two log file names so the newest generation wins.
 * @param left - one file name.
 * @param right - the other file name.
 * @returns a negative number when `left` is the newer generation.
 */
function compareLogNames(left, right) {
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
 * The artifact path a request names: a file the caller pointed at, or the log
 * of one session inside a dsh home.
 * @param source - the path the caller named.
 * @param session - the session id, when the source is a home directory.
 * @returns the artifact path.
 */
export function resolveArtifactPath(source, session) {
  if (!existsSync(source)) throw new Error(`no such path: ${source}`)
  if (statSync(source).isDirectory()) {
    if (session === undefined) {
      throw new Error('a session id is required when the source is a dsh home directory')
    }
    return resolveSessionLogPath(resolveSessionHome(source), session)
  }
  return source
}

/**
 * The artifact path a request names: a file the caller pointed at, or the log
 * of one session inside a dsh home. Only the path is resolved — nothing is read
 * — so a caller can ask the user for permission before touching the content.
 * @param request - what to read.
 * @returns the artifact path.
 */
export function resolveSessionArtifact(request) {
  const source = resolve(request.source)
  return request.logPath ?? resolveArtifactPath(source, request.session)
}
