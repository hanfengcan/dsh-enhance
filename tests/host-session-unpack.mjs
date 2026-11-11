/**
 * Behaviour of the Host half, without a dsh process.
 *
 * The Host half reads dsh Session artifacts: a concatenated Zstandard log, a
 * plain JSONL log, or a ZIP exported from the Session log export. These tests
 * build those artifacts on disk, then drive the same functions the
 * `unpack_session` tool calls.
 * @module dsh-enhance/host tests
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { zstdCompressSync } from 'node:zlib'

import {
  collectTurns, decodeZstdFrames, parseSessionLog, readSessionLog, readZipEntry, renderTranscript,
  resolveSessionHome, resolveSessionLogPath, scanZstdFrames, unpackSession,
} from '../packages/session-unpack/lib/session-unpack.js'

/** The header line every dsh session log starts with. */
const HEADER = {
  type: 'session',
  version: 4,
  id: 'session-11111111-2222-3333-4444-555555555555',
  createdAt: 1793533394977,
  cwd: 'C:\\work\\repo',
  isSeeded: false,
  delegationDepth: 0,
  agentPreset: 'standard',
}

/**
 * One event line.
 * @param fields - the event fields.
 * @returns the event.
 */
function event(fields) {
  return { seq: fields.seq ?? 0, time: 1793533395000, ...fields }
}

/**
 * The events of the fixture session: two turns, one tool call between them.
 * @returns the event list.
 */
function fixtureEvents() {
  return [
    event({ type: 'session/title', seq: 1, data: { title: '打开 云HIS系统' } }),
    event({ type: 'turn/start', seq: 2, data: { turn: 1, step: 1 } }),
    event({
      type: 'user/message',
      seq: 3,
      surfaceOp: 'append',
      data: {
        role: 'user',
        source: { kind: 'user' },
        content: [{ type: 'text', text: '打开 云HIS系统' }],
      },
    }),
    event({
      type: 'assistant/message',
      seq: 4,
      surfaceOp: 'append',
      data: {
        turn: 1,
        step: 1,
        message: { role: 'assistant', content: [{ type: 'text', text: '我先打开系统。' }] },
      },
    }),
    event({ type: 'tool/call', seq: 5, data: { turn: 1, step: 1, callId: 'call-1', name: 'business_systems', arguments: '{}' } }),
    event({
      type: 'tool/result',
      seq: 6,
      surfaceOp: 'append',
      data: {
        turn: 1,
        step: 1,
        message: {
          role: 'tool',
          toolCallId: 'call-1',
          isError: false,
          content: [{ type: 'text', text: '这个部署里有的业务系统：客户运营平台（mock）' }],
        },
      },
    }),
    event({
      type: 'assistant/message',
      seq: 7,
      surfaceOp: 'append',
      data: {
        turn: 1,
        step: 1,
        message: { role: 'assistant', content: [{ type: 'text', text: '已经打开云HIS系统。' }] },
      },
    }),
    event({ type: 'turn/end', seq: 8, data: { turn: 1 } }),
    event({ type: 'turn/start', seq: 9, data: { turn: 2, step: 1 } }),
    event({
      type: 'user/message',
      seq: 10,
      surfaceOp: 'append',
      data: {
        role: 'user',
        source: { kind: 'user' },
        content: [{ type: 'text', text: '名称这个下拉怎么用？' }],
      },
    }),
    event({
      type: 'assistant/message',
      seq: 11,
      surfaceOp: 'append',
      data: {
        turn: 2,
        step: 1,
        message: { role: 'assistant', content: [{ type: 'text', text: '它是一个自绘下拉，先 focus 再输入。' }] },
      },
    }),
    event({ type: 'turn/end', seq: 12, data: { turn: 2 } }),
  ]
}

/**
 * The fixture session's log text.
 * @returns the JSONL text.
 */
function fixtureText() {
  return [HEADER, ...fixtureEvents()].map(row => JSON.stringify(row)).join('\n') + '\n'
}

/**
 * A dsh home directory that owns one session log.
 * @param frames - how many Zstandard frames the log is split into.
 * @returns the home directory.
 */
function fixtureHome(frames = 3) {
  const home = mkdtempSync(join(tmpdir(), 'dsh-unpack-home-'))
  const directory = join(home, 'sessions', '--C-work-repo--', HEADER.id)
  mkdirSync(directory, { recursive: true })
  const lines = fixtureText().trimEnd().split('\n')
  const chunks = []
  for (let index = 0; index < lines.length; index += frames) {
    chunks.push(zstdCompressSync(Buffer.from(`${lines.slice(index, index + frames).join('\n')}\n`, 'utf8')))
  }
  writeFileSync(join(directory, 'session.v4.jsonl.zstd'), Buffer.concat(chunks))
  return home
}

/**
 * The CRC-32 of one buffer, as a ZIP entry records it.
 * @param buffer - the bytes to checksum.
 * @returns the checksum.
 */
function crc32(buffer) {
  let crc = 0xFFFFFFFF
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * A minimal ZIP archive holding the given files, stored without compression.
 * @param files - the entries, by name.
 * @returns the archive bytes.
 */
function buildZip(files) {
  const chunks = []
  const directory = []
  let offset = 0
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name, 'utf8')
    const data = Buffer.from(content, 'utf8')
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    chunks.push(local, nameBytes, data)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt32LE(checksum, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    directory.push(entry, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const centralBytes = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, centralBytes, end])
}

test('a concatenated Zstandard log decodes frame by frame', async () => {
  const home = fixtureHome(3)
  const path = resolveSessionLogPath(home, HEADER.id)
  const bytes = readFileSync(path)
  const frames = scanZstdFrames(bytes)
  assert.ok(frames.length > 1, 'the fixture log holds several frames')
  const decoded = (await decodeZstdFrames(bytes)).toString('utf8')
  assert.equal(decoded.trimEnd(), fixtureText().trimEnd())
})

test('the home and the session log are found inside an installation', () => {
  const home = fixtureHome()
  const installation = mkdtempSync(join(tmpdir(), 'dsh-unpack-install-'))
  mkdirSync(join(installation, 'home'), { recursive: true })
  const nested = join(installation, 'home', 'sessions', '--C-work-repo--', HEADER.id)
  mkdirSync(nested, { recursive: true })
  writeFileSync(join(nested, 'session.v4.jsonl.zstd'), readFileSync(resolveSessionLogPath(home, HEADER.id)))

  assert.equal(resolveSessionHome(installation), join(installation, 'home'))
  assert.equal(
    resolveSessionLogPath(resolveSessionHome(installation), HEADER.id),
    join(nested, 'session.v4.jsonl.zstd'),
  )
})

test('the transcript carries the user messages, the tools and the closing replies', async () => {
  const home = fixtureHome()
  const log = await readSessionLog(resolveSessionLogPath(home, HEADER.id))
  const transcript = await renderTranscript(log)

  assert.match(transcript, /^# 打开 云HIS系统/m)
  assert.match(transcript, /> 打开 云HIS系统/)
  assert.match(transcript, /\*\*Tool: `business_systems`\*\*/)
  assert.match(transcript, /客户运营平台（mock）/)
  assert.match(transcript, /已经打开云HIS系统。/)
  assert.match(transcript, /自绘下拉/)
})

test('an anchor starts the export at the turn that holds it', async () => {
  const home = fixtureHome()
  const path = resolveSessionLogPath(home, HEADER.id)

  const anchored = await unpackSession({ source: path, from: '名称这个下拉' })
  const transcript = readFileSync(join(anchored.outputPath, 'transcript.md'), 'utf8')
  assert.doesNotMatch(transcript, /> 打开 云HIS系统/)
  assert.match(transcript, /> 名称这个下拉怎么用？/)
  assert.equal(anchored.fromTurn, 2)

  const byNumber = await unpackSession({ source: path, from: '1' })
  const first = readFileSync(join(byNumber.outputPath, 'transcript.md'), 'utf8')
  assert.match(first, /> 打开 云HIS系统/)
})

test('an unknown anchor is refused', async () => {
  const home = fixtureHome()
  const path = resolveSessionLogPath(home, HEADER.id)
  await assert.rejects(() => unpackSession({ source: path, from: '这句话不在会话里' }), /no user message contains/)
})

test('the unpack writes the transcript, the event stream and the metadata', async () => {
  const home = fixtureHome()
  const out = mkdtempSync(join(tmpdir(), 'dsh-unpack-out-'))
  const result = await unpackSession({ source: home, session: HEADER.id, outputPath: out })

  assert.equal(result.sessionId, HEADER.id)
  assert.equal(result.title, '打开 云HIS系统')
  assert.equal(result.turns, 2)
  assert.deepEqual(result.files, ['transcript.md', 'session.jsonl', 'meta.json'])
  assert.equal(readFileSync(join(out, 'session.jsonl'), 'utf8').trimEnd(), fixtureText().trimEnd())
  const meta = JSON.parse(readFileSync(join(out, 'meta.json'), 'utf8'))
  assert.equal(meta.sessionId, HEADER.id)
  assert.equal(meta.events, fixtureEvents().length)
  assert.equal(meta.sourcePath, result.sourcePath)
})

test('a ZIP export is read as the same session', async () => {
  const archive = buildZip([['session.v4.jsonl', fixtureText()], ['media/picture.png', 'binary']])
  const directory = mkdtempSync(join(tmpdir(), 'dsh-unpack-zip-'))
  const path = join(directory, 'export.zip')
  writeFileSync(path, archive)

  assert.equal((await readZipEntry(archive, 'session.v4.jsonl')).toString('utf8'), fixtureText())
  const log = await readSessionLog(path)
  assert.equal(log.header.id, HEADER.id)
  assert.equal((await collectTurns(log.events)).length, 2)
})

test('a plain JSONL log is read as it stands', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-unpack-plain-'))
  const path = join(directory, 'session.v4.jsonl')
  writeFileSync(path, fixtureText())
  const log = await readSessionLog(path)
  assert.equal(log.events.length, fixtureEvents().length)
  assert.equal(parseSessionLog(fixtureText(), path).header.version, 4)
})

test('a cancelled call stops instead of unpacking', async () => {
  const home = fixtureHome()
  const path = resolveSessionLogPath(home, HEADER.id)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    () => unpackSession({ source: path }, controller.signal),
    failure => failure?.name === 'AbortError',
  )
})

test('the unpack lets the event loop keep running', async () => {
  const home = fixtureHome(1)
  const path = resolveSessionLogPath(home, HEADER.id)
  let ticked = false
  const timer = setTimeout(() => { ticked = true }, 0)
  await unpackSession({ source: path })
  assert.equal(ticked, true, 'the event loop kept running while the session was unpacked')
  clearTimeout(timer)
})
