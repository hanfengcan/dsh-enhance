/**
 * Host half of the dsh-enhance-session-unpack component.
 *
 * The component reads one dsh Session — from this installation, from another
 * installation's home directory, or from an exported archive — and unpacks it
 * into a directory a model can read.
 *
 * The Host half imports no Harness package: the tool registry accepts a plain
 * definition object, so the only dependency is Node itself.
 * @module dsh-enhance-session-unpack
 */

import { isAbsolute, relative as relativePath, resolve } from 'node:path'

import { resolveSessionArtifact } from './session-unpack/paths.js'
import { unpackSession } from './session-unpack/artifacts.js'

/** Cordis plugin name. */
export const name = 'dsh-enhance-session-unpack'

/** Services this half needs. */
export const inject = ['tools']

/**
 * Register the session-unpack tool for this composition.
 * @param ctx - the composed host context.
 */
export function apply(ctx) {
  ctx.tools.register({
    name: 'unpack_session',
    description: 'Unpack one dsh Session into a readable directory: transcript.md (the conversation as Markdown), '
      + 'session.jsonl (the raw event stream) and meta.json (the session metadata). The source is either a dsh '
      + 'installation or home directory (pass its session id) or one session artifact: a session.vN.jsonl.zstd log, '
      + 'a session.vN.jsonl log, or a ZIP exported from the Session log export. Use it to read a conversation that '
      + 'this session cannot see — another installation, an archived session, or an earlier part of a long session. '
      + 'Pass "from" with a fragment of a user message (or a turn number) to export only the tail of the session. '
      + 'Reading a session outside this session\'s workspace needs the user\'s approval.',
    // The raw JSON Schema the model sees — the same shape `defineTool` would
    // compile the author DSL into, without importing that helper.
    parameters: {
      type: 'object',
      required: ['source'],
      properties: {
        source: {
          type: 'string',
          description: 'A dsh installation directory, a dsh home directory, or one session artifact file '
            + '(session.vN.jsonl.zstd, session.vN.jsonl, or an exported .zip).',
        },
        session: {
          type: 'string',
          description: 'The session id, required when the source is a directory.',
        },
        from: {
          type: 'string',
          description: 'Export from here on: a fragment of a user message, or a turn number. The turn that holds the '
            + 'fragment is the first exported turn.',
        },
        maxTurns: {
          type: 'number',
          description: 'Stop after this many turns. Omit to export to the end of the session.',
        },
        out: {
          type: 'string',
          description: 'The directory to write the three artifacts into. Defaults to a temporary directory named after '
            + 'the session.',
        },
      },
    },
    output: {
      // The tool registry takes the raw JSON Schema subset, where requiredness
      // is an object-level array — not the author DSL's per-property flag.
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['sessionId', 'path', 'turns', 'events'],
        properties: {
          sessionId: { type: 'string', description: 'The session that was unpacked.' },
          path: { type: 'string', description: 'The directory holding the three artifacts.' },
          title: { type: 'string', description: 'The session title, when the log carries one.' },
          turns: { type: 'number', description: 'How many turns the session holds.' },
          events: { type: 'number', description: 'How many event lines the log holds.' },
          fromTurn: { type: 'number', description: 'The first exported turn, when an anchor was given.' },
          files: { type: 'array', items: { type: 'string' }, description: 'The written artifacts.' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Unpacked ${value.sessionId} into ${value.path}\n`
          + `turns: ${String(value.turns)}, events: ${String(value.events)}`
          + `${value.fromTurn === undefined ? '' : `, from turn ${String(value.fromTurn)}`}\n`
          + `files: ${value.files.join(', ')}`,
      }],
    },
    async execute(args, exec) {
      if (typeof args.source !== 'string' || args.source.trim() === '') {
        throw new Error('unpack_session needs a source: a dsh home directory or one session artifact')
      }
      for (const name of ['session', 'from', 'out']) {
        if (args[name] !== undefined && typeof args[name] !== 'string') {
          throw new Error(`${name} must be a string`)
        }
      }
      if (args.maxTurns !== undefined && (!Number.isInteger(args.maxTurns) || args.maxTurns < 1)) {
        throw new Error('maxTurns must be a positive integer')
      }
      // Resolve the artifact path first: the permission question is about a
      // path, and nothing may be read before the user has answered it.
      const logPath = resolveSessionArtifact({ source: args.source, session: args.session })
      await approveHostRead(ctx, exec, logPath)
      const result = await unpackSession({
        source: args.source,
        session: args.session,
        logPath,
        from: args.from,
        maxTurns: args.maxTurns,
        outputPath: args.out,
      }, exec.signal)
      // The canonical value must be lossless JSON: an undefined key is not one.
      return {
        sessionId: result.sessionId,
        path: result.outputPath,
        ...result.title === undefined ? {} : { title: result.title },
        turns: result.turns,
        events: result.events,
        ...result.fromTurn === undefined ? {} : { fromTurn: result.fromTurn },
        files: result.files,
      }
    },
  })
}

/**
 * Ask the user for permission when a session artifact lives outside this
 * session's workspace. A deployment that already runs with full access needs
 * no question.
 * @param ctx - the composed host context.
 * @param exec - the running tool call.
 * @param artifactPath - the artifact the call reads.
 */
async function approveHostRead(ctx, exec, artifactPath) {
  const policy = ctx.get('sandboxPolicy')
  const resolved = policy?.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
  if (resolved?.mode === 'danger-full-access') return
  const root = resolved?.workspaceRoot
  if (root !== undefined && isInside(root, artifactPath)) return
  // A directory the deployment granted on purpose needs no second question.
  const granted = resolved?.additionalWritableRoots
  if (granted !== undefined && granted.some(entry => isInside(entry, artifactPath))) return
  const approver = ctx.get('approval')
  if (approver === undefined) {
    throw new Error(`reading ${artifactPath} needs approval, but no approval service is composed`)
  }
  if (exec.agent === undefined) {
    throw new Error(`reading ${artifactPath} needs approval, but the call has no agent to route it through`)
  }
  const outcome = await approver.request({
    agent: exec.agent,
    toolName: 'unpack_session',
    callId: exec.callId,
    reason: `unpack_session reads a session artifact outside this session's workspace: ${artifactPath}`,
    displayReason: {
      en: `Read the dsh session artifact ${artifactPath}? It lives outside this session's workspace.`,
    },
    signal: exec.signal,
  })
  if (outcome !== 'allowed-once') {
    throw new Error(`reading ${artifactPath} was not approved (${outcome}). `
      + 'unpack_session reads session artifacts outside this session\'s workspace, so the user has to allow it; '
      + 'a session whose approval policy is "never" cannot use it.')
  }
}

/**
 * Tell whether a path lies inside a directory.
 * @param root - the directory to test against.
 * @param candidate - the path to test.
 * @returns true when the candidate is the root itself or lives under it.
 */
function isInside(root, candidate) {
  const relative = relativePath(resolve(root), resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !isAbsolute(relative))
}
