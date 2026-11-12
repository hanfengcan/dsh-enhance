# dsh-enhance-session-unpack (Session unpack)

A model-facing `unpack_session` tool that unpacks one dsh Session into a readable directory:
`transcript.md` + `session.jsonl` + `meta.json`.

It is the second component of the [dsh-enhance](../../README.en.md) bundle, independent of *Automation
task* and *Reply alerts*: turning it off leaves the other two working.

[中文](./README.md) | English

---

## What it is for

A dsh Session lives on disk as an append-only log: `session.v4.jsonl.zstd`, a container of concatenated
Zstandard frames, one frame per durable append, one JSON event per line. Node's own
`zstdDecompressSync` decodes only the *first* frame of such a file (a 249-byte header), so a plain
unpacker gets nothing. The session may also not be in front of you: it may live in another installation,
be an exported ZIP, or be the tail of a long conversation the current session cannot see.

`unpack_session` takes either a dsh installation/home directory plus a session id, or one artifact file
(a `session.vN.jsonl.zstd` log, a `session.vN.jsonl` log, or an exported `.zip`), and writes:

| File | Content |
| --- | --- |
| `transcript.md` | The conversation as Markdown, in the shipped renderer's shape (user messages quoted, tool calls and results folded into `<details>`, each turn's closing reply laid out flat). |
| `session.jsonl` | The **complete** decoded event stream — the decompressed truth, not trimmed. |
| `meta.json` | Session id, title, source path, turn and event counts, anchor, export time. |

Parameters: `source` (the directory or the artifact), `session` (the id, when the source is a directory),
`from` (an anchor: a fragment of a user message, or a turn number), `maxTurns`, and `out` (the output
directory; defaults to `%TMP%\dsh-session-unpack\<session-id>`).

The source may be `<dir>/sessions` or `<dir>/home/sessions`; the log lives at
`<home>/sessions/<workspace-slug>/<session-id>/session.vN.jsonl.zstd`, and the newest generation wins.

A ZIP works as well: the archive the shipped "export session log" produces holds a **plain**
`session.vN.jsonl`, while a ZIP of the session folder **assembled by hand** holds the **compressed**
`session.vN.jsonl.zstd` — both are read. When the archive holds several generations, the newest one
wins.

## Reading outside the workspace asks first

The tool resolves the artifact path, asks the user through `ctx.approval.request`, and only then reads
a byte. No question is asked when the deployment runs with full access, when the artifact is inside the
session's workspace, or when the artifact is inside a directory the deployment granted on purpose
(`--add-dir` / `additionalWritableRoots`). A session whose approval policy is `never` cannot use the tool
— it says so instead of reading quietly.

## What it is made of

| Part | Responsibility |
| --- | --- |
| `src/session-unpack/frames.js` | Zstandard frame boundary scan and per-frame decoding |
| `src/session-unpack/zip.js` | ZIP central directory parsing and entry reading |
| `src/session-unpack/paths.js` | Locating the home directory and the session log |
| `src/session-unpack/log.js` | Artifact reading and event parsing |
| `src/session-unpack/transcript.js` | Event stream → turns, transcript rendering |
| `src/session-unpack/artifacts.js` | Writing the three artifacts |
| `src/index.js` | Host entry: registers `unpack_session` through `ctx.tools.register`, and the approval for reading outside the workspace |

Decisions worth naming:

- **The Zstandard frame boundaries are walked in the byte stream** (the frame header states its layout and
  each block header states its size) and each frame is then decompressed on its own. The shipped
  `session-persistence-jsonl` does the same kind of pure byte scan.
- **Unpacking never keeps the Host busy**: the per-frame decompression runs on `node:zlib`'s async
  interface (in the libuv thread pool), and event parsing and transcript rendering hand the event loop
  back every 200 events / 50 turns.
- **The call is cancellable**: the signal is checked between two frames and between two batches of
  events; an aborted call throws `AbortError` and **leaves no half-written directory behind** (the
  directory is created once all artifacts are ready).
- **The ZIP reader is its own**: end-of-central-directory record, central directory and local headers,
  with async `inflateRaw` for deflate entries; **ZIP64 archives are reported as unsupported** rather
  than guessed at. The log entry inside may be plain text or a compressed `.jsonl.zstd` — the latter
  goes through the same frame decoding as a log on disk.
- **The Host half imports no Harness package at all** (`ctx.tools.register` takes a plain object, and
  every format is read with Node's own zlib).
- **`session.jsonl` keeps the whole event stream** while only `transcript.md` is trimmed to the anchor:
  the truth of the decompression and the convenience of reading are kept apart.
- **Artifacts land in a temporary directory by default**: the user's repository stays clean; `out` can
  override that.
- **Reading outside the workspace always asks first**, even when the target path looks harmless (it has
  to be an artifact that yields a session).

## Host contracts it depends on

- `ctx.tools.register`, to register the tool;
- `ctx.approval`, for reading outside the workspace.

## Build and test

```sh
cd packages/session-unpack
npm install
npm run bundle          # output in lib/ (not tracked)
```

The tests live in the repository root:

```sh
node --test tests/host-session-unpack.mjs      # the unpacking itself
node --test tests/host-tool-registration.mjs   # registration and approval order
```

`host-session-unpack.mjs` builds three artifacts on disk (multi-frame zstd / plain jsonl / zip) and
covers the frame scan and decoding, the installation-directory lookup, the transcript rendering, the
anchor (a fragment and a turn number), a missing anchor, the three artifacts, the zip export,
**a compressed log inside a zip**, **the newest generation winning inside a zip**, the plain
jsonl, plus **stopping on cancellation** and **the event loop still running while unpacking**.

`host-tool-registration.mjs` drives the registered tool through a fake context and covers the
registration shape, **asking before reading outside the workspace**, the no-question cases (inside the
workspace, full access, a granted directory), and no artifacts left behind after a refusal.

## License

MIT
