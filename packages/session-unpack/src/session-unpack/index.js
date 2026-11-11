/**
 * The session reader of the dsh-enhance-session-unpack component.
 *
 * The modules behind it are split by what they do: the Zstandard frames of a
 * log, the ZIP of an export, where a session lives, how a log is read, how a
 * transcript is rendered, and what an unpacked session is made of.
 * @module dsh-enhance/session-unpack
 */

export { unpackSession } from './artifacts.js'
export { decodeZstdFrames, scanZstdFrames } from './frames.js'
export { parseSessionLog, readSessionLog } from './log.js'
export { resolveArtifactPath, resolveSessionArtifact, resolveSessionHome, resolveSessionLogPath } from './paths.js'
export { collectTurns, findAnchor, normalizeTitle, renderTranscript, sessionTitle } from './transcript.js'
export { findExportedLogEntry, listZipEntries, readZipEntry } from './zip.js'
