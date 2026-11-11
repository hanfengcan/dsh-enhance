/**
 * The `unpack_session` tool registration, without a dsh process.
 *
 * The tool's only Host contract is `ctx.tools.register`, so a plain object is
 * enough to stand in for the composed context. These tests drive the registered
 * tool the way the Host would: they check that a session artifact outside the
 * workspace is only read after the user allowed it, that an artifact inside the
 * workspace is read without a question, and that a refused permission leaves no
 * output behind.
 * @module dsh-enhance/host tool tests
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply, name as pluginName } from '../packages/session-unpack/lib/index.js'

/** The header line every dsh session log starts with. */
const HEADER = {
  type: 'session',
  version: 4,
  id: 'session-99999999-8888-7777-6666-555555555555',
  createdAt: 1793533394977,
  cwd: 'C:\\work\\repo',
  isSeeded: false,
  delegationDepth: 0,
  agentPreset: 'standard',
}

/**
 * One session log on disk, plain JSONL.
 * @returns the artifact path.
 */
function fixtureArtifact() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-unpack-tool-'))
  const path = join(directory, 'session.v4.jsonl')
  const rows = [
    HEADER,
    { seq: 1, time: 1793533395000, type: 'turn/start', data: { turn: 1, step: 1 } },
    {
      seq: 2,
      time: 1793533395000,
      type: 'user/message',
      surfaceOp: 'append',
      data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '看下拉结构' }] },
    },
    {
      seq: 3,
      time: 1793533395000,
      type: 'assistant/message',
      surfaceOp: 'append',
      data: { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '是 vxe-pulldown。' }] } },
    },
    { seq: 4, time: 1793533395000, type: 'turn/end', data: { turn: 1 } },
  ]
  writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
  return path
}

/**
 * A composed context that records the registered tool and the asked permissions.
 * @param options - the policy and the answerer to hand out.
 * @returns the fake context and the record it keeps.
 */
function fakeContext(options) {
  const record = { registered: undefined, asks: [] }
  const ctx = {
    tools: {
      register(definition) {
        record.registered = definition
      },
    },
    get(key) {
      if (key === 'sandboxPolicy') {
        return { resolve: () => options.policy }
      }
      if (key === 'approval') return options.approval
      return undefined
    },
  }
  return { ctx, record }
}

/**
 * The tool execution the Host hands to a tool.
 * @param cwd - the session's working directory.
 * @returns the execution.
 */
function fakeExecution(cwd) {
  return {
    agent: { session: { header: { cwd } } },
    callId: 'call-1',
    signal: new AbortController().signal,
  }
}

test('the plugin registers the unpack_session tool', () => {
  const { ctx, record } = fakeContext({ policy: { mode: 'danger-full-access' } })
  apply(ctx)
  assert.equal(pluginName, 'dsh-enhance-session-unpack')
  assert.equal(record.registered.name, 'unpack_session')
  assert.equal(typeof record.registered.execute, 'function')
  assert.equal(record.registered.parameters.type, 'object')
  assert.ok(record.registered.parameters.properties.source !== undefined)
  assert.ok(record.registered.parameters.properties.from !== undefined)
  assert.ok(record.registered.output.schema !== undefined)
  assert.ok(record.registered.output.render !== undefined)
})

test('the schemas stay inside the raw JSON Schema subset the Host accepts', () => {
  const { ctx, record } = fakeContext({ policy: { mode: 'danger-full-access' } })
  apply(ctx)
  // The Host validates the registered schema itself: `required` is an
  // object-level array there, never a per-property flag. A per-property
  // `required: true` makes the whole plugin fail to load, so the shape is
  // asserted here rather than discovered in a running Host.
  assertNoPerPropertyRequired(record.registered.parameters, 'parameters')
  assertNoPerPropertyRequired(record.registered.output.schema, 'output.schema')
  assert.deepEqual(record.registered.parameters.required, ['source'])
  assert.deepEqual(record.registered.output.schema.required, ['sessionId', 'path', 'turns', 'events'])
})

/**
 * Assert that no node of a schema carries a `required` flag of its own.
 * @param node - the schema node to walk.
 * @param path - the node's path, for the failure message.
 */
function assertNoPerPropertyRequired(node, path) {
  if (node === null || typeof node !== 'object') return
  if (node.type !== 'object') {
    assert.equal(Object.hasOwn(node, 'required'), false, `${path} must not carry its own required flag`)
  }
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    assertNoPerPropertyRequired(value, `${path}.properties.${key}`)
  }
  if (node.items !== undefined) assertNoPerPropertyRequired(node.items, `${path}.items`)
}

test('an artifact outside the workspace is read only after the user allowed it', async () => {
  const artifact = fixtureArtifact()
  const out = join(mkdtempSync(join(tmpdir(), 'dsh-unpack-out-')), 'unpacked')
  const asked = []
  const { ctx, record } = fakeContext({
    policy: { mode: 'workspace-write', workspaceRoot: 'C:\\work\\repo' },
    approval: {
      async request(request) {
        asked.push(request)
        // The question comes before the read: nothing is written yet.
        assert.equal(existsSync(join(out, 'transcript.md')), false)
        return 'allowed-once'
      },
    },
  })
  apply(ctx)

  const result = await record.registered.execute({ source: artifact, out }, fakeExecution('C:\\work\\repo'))

  assert.equal(asked.length, 1)
  assert.equal(asked[0].toolName, 'unpack_session')
  assert.equal(asked[0].callId, 'call-1')
  assert.match(asked[0].reason, /outside this session's workspace/)
  assert.equal(result.sessionId, HEADER.id)
  assert.equal(existsSync(join(out, 'transcript.md')), true)
})

test('an artifact inside the workspace is read without a question', async () => {
  const artifact = fixtureArtifact()
  const out = join(mkdtempSync(join(tmpdir(), 'dsh-unpack-out-')), 'unpacked')
  const asked = []
  const { ctx, record } = fakeContext({
    policy: { mode: 'workspace-write', workspaceRoot: artifact.replace(/[\\/][^\\/]+$/u, '') },
    approval: { async request(request) { asked.push(request); return 'allowed-once' } },
  })
  apply(ctx)

  const result = await record.registered.execute({ source: artifact, out }, fakeExecution(artifact.replace(/[\\/][^\\/]+$/u, '')))

  assert.equal(asked.length, 0)
  assert.equal(result.events, 4)
})

test('a full-access deployment reads without a question', async () => {
  const artifact = fixtureArtifact()
  const out = join(mkdtempSync(join(tmpdir(), 'dsh-unpack-out-')), 'unpacked')
  const asked = []
  const { ctx, record } = fakeContext({
    policy: { mode: 'danger-full-access', workspaceRoot: 'C:\\work\\repo' },
    approval: { async request(request) { asked.push(request); return 'allowed-once' } },
  })
  apply(ctx)

  await record.registered.execute({ source: artifact, out }, fakeExecution('C:\\work\\repo'))
  assert.equal(asked.length, 0)
})

test('a granted directory needs no question either', async () => {
  const artifact = fixtureArtifact()
  const out = join(mkdtempSync(join(tmpdir(), 'dsh-unpack-out-')), 'unpacked')
  const asked = []
  const { ctx, record } = fakeContext({
    policy: {
      mode: 'workspace-write',
      workspaceRoot: 'C:\\work\\repo',
      additionalWritableRoots: [artifact.replace(/[\\/][^\\/]+$/u, '')],
    },
    approval: { async request(request) { asked.push(request); return 'allowed-once' } },
  })
  apply(ctx)

  await record.registered.execute({ source: artifact, out }, fakeExecution('C:\\work\\repo'))
  assert.equal(asked.length, 0)
})

test('a refused permission leaves no output behind', async () => {
  const artifact = fixtureArtifact()
  const out = join(mkdtempSync(join(tmpdir(), 'dsh-unpack-out-')), 'unpacked')
  const { ctx, record } = fakeContext({
    policy: { mode: 'workspace-write', workspaceRoot: 'C:\\work\\repo' },
    approval: { async request() { return 'rejected' } },
  })
  apply(ctx)

  await assert.rejects(
    () => record.registered.execute({ source: artifact, out }, fakeExecution('C:\\work\\repo')),
    /was not approved \(rejected\)/,
  )
  assert.equal(existsSync(out), false)
})

