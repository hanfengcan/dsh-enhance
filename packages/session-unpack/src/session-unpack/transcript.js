/**
 * The Markdown transcript of a dsh Session.
 *
 * The transcript is what a model reads: the user messages are quoted, the tool
 * calls and their results are collapsed, and the closing reply of every turn
 * stands on its own.
 * @module dsh-enhance/session-unpack/transcript
 */

/**
 * How many events are processed between two yields to the event loop.
 */
const EVENTS_PER_YIELD = 200

/**
 * How many turns are rendered between two yields to the event loop.
 */
const TURNS_PER_YIELD = 50

/**
 * Give the event loop a turn, so a long transcript does not keep the Host busy.
 */
function yieldToEventLoop() {
  return new Promise(resolve => { setImmediate(resolve) })
}

/**
 * The text of one message's content blocks.
 * @param content - the message content blocks.
 * @returns the readable text.
 */
function visibleContent(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string' && block.text !== '') parts.push(block.text)
    else if (block.type === 'image') parts.push(imageLabel(block.attachment))
    else if (block.type === 'file') parts.push(fileLabel(block.attachment))
  }
  return parts.join('\n\n')
}

/**
 * The label one image attachment gets in a transcript.
 * @param attachment - the attachment reference.
 * @returns the label.
 */
function imageLabel(attachment) {
  const reference = attachment ?? {}
  return `[Image: ${labelName(reference.name)} (${String(reference.width)}×${String(reference.height)}, ${String(reference.bytes)} bytes)]`
}

/**
 * The label one file attachment gets in a transcript.
 * @param attachment - the attachment reference.
 * @returns the label.
 */
function fileLabel(attachment) {
  const reference = attachment ?? {}
  return `[File: ${labelName(reference.name)} (${String(reference.bytes)} bytes)]`
}

/**
 * The attachment name a label shows.
 * @param name - the attachment name.
 * @returns a safe label name.
 */
function labelName(name) {
  const normalized = typeof name === 'string' ? name.replace(/\s+/gu, ' ').replace(/\]/gu, '\\]').trim() : ''
  return normalized === '' ? 'attachment' : normalized
}

/**
 * Quote one user message the way the shipped Session log does.
 * @param text - the message text.
 * @returns the quoted block.
 */
function quote(text) {
  const normalized = text.replace(/\r\n?/gu, '\n').replace(/\n+$/u, '')
  return normalized.split('\n').map(line => (line === '' ? '>' : `> ${line}`)).join('\n')
}

/**
 * Fence one block of text, widening the fence past any fence it contains.
 * @param text - the text to fence.
 * @param language - the fence's language tag.
 * @returns the fenced block.
 */
function fenced(text, language = '') {
  const content = text.replace(/\n+$/u, '')
  let longest = 0
  for (const match of content.matchAll(/`+/gu)) longest = Math.max(longest, match[0].length)
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}${language}\n${content}\n${fence}`
}

/**
 * Indent one JSON argument string for the transcript.
 * @param argumentsText - the raw argument text.
 * @returns the pretty-printed text, or the raw text when it is not JSON.
 */
function jsonArguments(argumentsText) {
  try {
    return JSON.stringify(JSON.parse(argumentsText), null, 2)
  } catch {
    return argumentsText
  }
}

/**
 * One turn of the transcript: the segments a turn is made of.
 * @typedef {{kind: 'user', text: string}
 *   | {kind: 'assistant', text: string, toolCalls: boolean}
 *   | {kind: 'tool', name: string, arguments: string, result: {text: string, isError: boolean, reason: string | undefined} | undefined}} TurnSegment
 */

/**
 * Split the event stream into its turns.
 *
 * The event loop is given a turn every few hundred events, so a session with
 * tens of thousands of events does not keep the Host busy while it is read.
 * @param events - the event lines.
 * @param signal - the cancellation signal of the running call.
 * @returns the turns, in order.
 */
export async function collectTurns(events, signal) {
  const turns = []
  let current
  const begin = () => {
    current = { segments: [], calls: new Map() }
    turns.push(current)
  }
  const active = () => current ?? begin()
  for (let index = 0; index < events.length; index += 1) {
    if (index % EVENTS_PER_YIELD === 0) {
      signal?.throwIfAborted()
      await yieldToEventLoop()
    }
    const event = events[index]
    switch (event.type) {
      case 'turn/start':
        begin()
        break
      case 'turn/end':
        current = undefined
        break
      case 'user/message': {
        if (event.surfaceOp !== 'append') break
        const source = event.data?.source
        if (source?.kind !== 'user') break
        const text = visibleContent(event.data?.content)
        if (text !== '') active().segments.push({ kind: 'user', text })
        break
      }
      case 'assistant/message': {
        if (event.surfaceOp !== 'append') break
        const message = event.data?.message
        if (message === undefined) break
        const text = visibleContent(message.content)
        const toolCalls = Array.isArray(message.content)
          && message.content.some(block => block?.type === 'tool-call')
        if (text.trim() !== '') active().segments.push({ kind: 'assistant', text, toolCalls })
        break
      }
      case 'tool/call': {
        const entry = {
          kind: 'tool',
          name: String(event.data?.name ?? 'unknown'),
          arguments: String(event.data?.arguments ?? ''),
          result: undefined,
        }
        active().segments.push(entry)
        active().calls.set(String(event.data?.callId), entry)
        break
      }
      case 'tool/result': {
        if (event.surfaceOp !== 'append') break
        const message = event.data?.message
        const callId = String(message?.toolCallId)
        let entry = active().calls.get(callId)
        if (entry === undefined) {
          entry = { kind: 'tool', name: 'unknown', arguments: '', result: undefined }
          active().segments.push(entry)
          active().calls.set(callId, entry)
        }
        entry.result = {
          text: visibleContent(message?.content),
          isError: message?.isError === true,
          reason: event.data?.error?.reason,
        }
        break
      }
      default:
        break
    }
  }
  return turns.filter(turn => turn.segments.length > 0)
}

/**
 * Render one tool entry as the shipped Session log renders it.
 * @param entry - the tool segment.
 * @returns the rendered block.
 */
function renderToolEntry(entry) {
  const heading = `**Tool: \`${entry.name}\`**`
  const argumentsText = entry.arguments === ''
    ? '(no arguments)'
    : fenced(jsonArguments(entry.arguments), 'json')
  const result = entry.result
  const resultHeading = result?.isError === true ? '**Result (error)**' : '**Result**'
  let body
  if (result === undefined) body = '(no result recorded)'
  else if (result.reason !== undefined && result.reason !== '') {
    body = `Error: ${result.reason}`
    if (result.text !== '') body += `\n\n${fenced(result.text)}`
  } else if (result.text === '') body = '(no output)'
  else body = fenced(result.text)
  return `${heading}\n\n${argumentsText}\n\n${resultHeading}\n\n${body}`
}

/**
 * Render the turns before a turn's closing reply as one collapsed block.
 * @param entries - the segments to collapse.
 * @returns the collapsed block.
 */
function collapsibleSection(entries) {
  const summary = entries.length === 1 ? '1 previous message' : `${String(entries.length)} previous messages`
  const body = entries.map(renderSegment).join('\n\n')
  return `<details><summary>${summary}</summary>\n\n${body}\n\n</details>`
}

/**
 * Render one turn segment.
 * @param entry - the segment.
 * @returns the rendered block.
 */
function renderSegment(entry) {
  if (entry.kind === 'assistant') return `**Assistant**\n\n${entry.text}`
  return renderToolEntry(entry)
}

/**
 * The index of the turn's closing reply, or -1 when it has none.
 * @param segments - the turn's segments.
 * @returns the closing reply's index.
 */
function finalReplyIndex(segments) {
  const index = segments.length - 1
  const entry = segments[index]
  return entry?.kind === 'assistant' && !entry.toolCalls ? index : -1
}

/**
 * Render one Session log as Markdown.
 * @param log - the decoded log.
 * @param options - the export options: the first turn to include and how many.
 * @param signal - the cancellation signal of the running call.
 * @returns the Markdown transcript.
 */
export async function renderTranscript(log, options = {}, signal) {
  const turns = await collectTurns(log.events, signal)
  const startTurn = options.fromTurn === undefined ? 0 : options.fromTurn
  const sections = [`# ${normalizeTitle(log)}`]
  sections.push(`Session file:\n\n${fenced(log.sourcePath, 'text')}`)
  if (options.fromTurn !== undefined && options.fromTurn > 0) {
    sections.push(`Export starts at turn ${String(options.fromTurn + 1)}`)
  }
  const selected = turns.slice(startTurn, options.maxTurns === undefined ? undefined : startTurn + options.maxTurns)
  for (let index = 0; index < selected.length; index += 1) {
    if (index % TURNS_PER_YIELD === 0) {
      signal?.throwIfAborted()
      await yieldToEventLoop()
    }
    const turn = selected[index]
    const closing = finalReplyIndex(turn.segments)
    const end = closing < 0 ? turn.segments.length : closing
    let pending = []
    for (const segment of turn.segments.slice(0, end)) {
      if (segment.kind === 'user') {
        if (pending.length > 0) {
          sections.push(collapsibleSection(pending))
          pending = []
        }
        sections.push(quote(segment.text))
      } else {
        pending.push(segment)
      }
    }
    if (pending.length > 0) sections.push(collapsibleSection(pending))
    const final = turn.segments[closing]
    if (final?.kind === 'assistant') sections.push(final.text)
  }
  return `${sections.join('\n\n').trimEnd()}\n`
}

/**
 * The title the log carries, when it has one.
 * @param log - the decoded log.
 * @returns the raw title, or undefined.
 */
export function sessionTitle(log) {
  const title = log.events.findLast(event => event.type === 'session/title')?.data?.title
  return typeof title === 'string' ? title : undefined
}

/**
 * The title a transcript starts with.
 * @param log - the decoded log.
 * @returns the title.
 */
export function normalizeTitle(log) {
  const title = sessionTitle(log)
  const line = typeof title === 'string' ? title.replace(/\r\n?|\n/gu, ' ').trim() : ''
  return line === '' ? 'Untitled Session' : line
}

/**
 * Find the turn an anchor names.
 * @param turns - the session's turns.
 * @param anchor - the anchor text or turn number.
 * @returns the matching turn and the text that matched.
 */
export function findAnchor(turns, anchor) {
  const asNumber = /^\d+$/.test(anchor.trim()) ? Number(anchor.trim()) : undefined
  if (asNumber !== undefined) {
    const index = asNumber - 1
    if (index < 0 || index >= turns.length) {
      throw new Error(`turn ${String(asNumber)} is outside this session: it holds ${String(turns.length)} turns`)
    }
    const text = firstUserText(turns[index]) ?? ''
    return { turn: index, text }
  }
  for (let index = 0; index < turns.length; index += 1) {
    for (const segment of turns[index].segments) {
      if (segment.kind === 'user' && segment.text.includes(anchor)) {
        return { turn: index, text: segment.text }
      }
    }
  }
  throw new Error(`no user message contains ${JSON.stringify(anchor)}`)
}

/**
 * The first user message of one turn.
 * @param turn - the turn.
 * @returns the message text, or undefined.
 */
function firstUserText(turn) {
  const segment = turn.segments.find(entry => entry.kind === 'user')
  return segment?.kind === 'user' ? segment.text : undefined
}
