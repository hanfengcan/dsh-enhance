# dsh-enhance

Three additions to **DeepSeek Harness (dsh)**, shipped as **one plugin with three components you can
switch on and off separately**:

| Component | What it does |
| --- | --- |
| **Automation task** (`dsh-enhance-schedule`) | Create an automation task *for the conversation you are in*, from the composer dock, and open the shipped right-Sidebar task page on it. |
| **Session unpack** (`dsh-enhance-session-unpack`) | A model-facing `unpack_session` tool that unpacks one dsh Session into a readable directory: `transcript.md` + `session.jsonl` + `meta.json`. |
| **Reply alerts** (`dsh-enhance-notify`) | A chime when a reply finishes, plus a Windows notification while the window is in the background (its switches live on the Plugins page). |

Each component carries its own name, description and switch on the Plugins page — turning one off leaves
the others working.

English | [中文](./README.md)

---

## `unpack_session`

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

**Reading outside the workspace asks first.** The tool resolves the artifact path, asks the user through
`ctx.approval.request`, and only then reads a byte. No question is asked when the deployment runs with
full access, when the artifact is inside the session's workspace, or when the artifact is inside a
directory the deployment granted on purpose. A session whose approval policy is `never` cannot use the
tool — it says so instead of reading quietly.

Decisions worth naming: the Zstandard frame boundaries are walked in the byte stream (the frame header
states its layout and each block header states its size) and each frame is then decompressed on its own,
off the event loop, so a long session never keeps the Host busy while it unpacks — the call is also
cancellable: the signal is checked between two frames and between two batches of events, and an aborted
call leaves no half-written directory behind; the ZIP reader parses the end-of-central-directory record and
the central directory itself and reports ZIP64 archives as unsupported rather than guessing; the Host half
imports no Harness package at all (`ctx.tools.register` takes a plain object, and every format is read with
Node's own zlib); and `session.jsonl` keeps the whole event stream while only `transcript.md` is trimmed to
the anchor.

## The "automation task" component

dsh's own "new automation task" editor can only target a *new* session. This component adds that entry
point: one "Schedule a task" pill in the dock under the input box, one form (name / instruction / time),
and the task is bound to the very session you are looking at.

It loads **no Harness Client package**: the dialog, the button, the input, the dropdown, the month card
and the clock card are the plugin's own copies of the shipped controls — same markup, same behaviour,
this plugin's class names, the Host theme's tokens as the only styling dependency.

The task stays a native dsh automation task: it shows in the official Automation tasks panel, in the
Session header's task badge, and in the official right-Sidebar page where you can inspect, edit, run or
delete it.

The form's rows mirror the shipped "manual create" dialog: run target (the current session, fixed),
repeat (Weekly / Monday to Friday / Every day / Every N hours / Every N minutes / Every month / Once /
Custom), repeat interval, weekday pills, a self-drawn month card for a one-shot date, a self-drawn
three-column clock card, and a searchable time-zone menu. The shipped behaviour of *greying out Create
and staying quiet* is copied too: a red line appears at the bottom of the dialog only when the Host
actually refuses the creation.

## The "reply alerts" component

dsh never says "this turn is done". Work in another window and you come back guessing; on the desktop
it is worse — a minimized window shows nothing at all.

This component answers a finished turn with a **chime**, and — while the window is in the background
(another app, minimized, or a different browser tab) — with a **system notification**, which is a Windows
toast. Clicking the toast brings the window back to the front.

**How it knows a turn ended.** The Host forwards `api-session/status` whenever an Agent changes running
state. The component remembers which sessions are running: `true` marks one, `false` on a session that
was running is one finished turn. A `false` without a preceding `true` (the initial state after a
connect, a disposed Agent) is not an ending. A subagent's own turn is not a reply to the user, so it
stays quiet.

**The surface.** The switches live on the **Plugins page**: open the Plugins page, go into *DSH
enhancements*, and press *Configure* on the *Reply alerts* row. The page it opens carries two switches —
*Chime* and *System notification* — a *Tone* picker offering four synthesized tones (*Chime*, *Bell*,
*Pulse*, *Wave*), and a *Preview* button that plays the chosen tone once. The switches and the tone
live in this browser's `localStorage` under `dsh.enhance.notify`. The Configure entry is the Host's own
seat for a component's configuration (`plugins.row.config`), keyed by `<bundle package>#<component id>`;
it appears while the component is enabled and leaves with it.

**Known limits.** The first chime needs one user interaction (the browser's autoplay policy); the
component unlocks the audio context on the first pointer or key event, so it works after a normal
session. The notification permission belongs to the browser and is asked for with the first toast. The
toast only appears while the window is unfocused — a toast for a reply you are watching is noise, not a
signal. And the component knows *that* a turn ended, not what it said: the toast names the session, it
does not carry the reply.

## Layout

The sources live in `src/`, the deliverable in `lib/`. `lib/` is build output and stays out of version
control.

```
dsh-enhance/                  bundle: inserts three rows, carries no code
├── cordis.patch.yml
├── locale/                   plugin-page title and description
└── packages/
    ├── schedule/             component one: automation task
    │   ├── src/index.js      Host half (empty entry)
    │   ├── src/client/       browser half (split into a dozen modules)
    │   ├── lib/              build output (not tracked)
    │   └── tsdown.config.mjs
    ├── session-unpack/       component two: session unpack
        ├── src/index.js      Host entry: registers the tool, asks for approval
        ├── src/session-unpack/  the reader itself (frames / zip / paths / log / transcript / artifacts)
        ├── lib/              build output (not tracked)
        └── tsdown.config.mjs
    └── notify/               component three: reply alerts
        ├── src/index.js      Host half (empty entry)
        ├── src/client/       browser half (status events / chime / notification / configuration page)
        │   └── components/settings-page.js  the settings page on the Plugins page
        ├── lib/              build output (not tracked)
        └── tsdown.config.mjs
```

## Install

The bundle carries no code of its own: it inserts three rows into the composition tree, one per component,
and all three component packages have to reach the profile's `node_modules` under their own names.

### 1) Build first

A link installation points at this directory, so the build has to exist before the plugin is installed:
without `lib/`, the Host finds an empty entry when it loads a component by package name.

```sh
# build both components from the root
npm install
npm run bundle
```

Or build one component at a time (`npm run watch` keeps rebuilding while you edit `src/`):

```sh
cd packages/schedule && npm install && npm run bundle
cd packages/session-unpack && npm install && npm run bundle
cd packages/notify && npm install && npm run bundle
```

> The build needs one development dependency, `tsdown`. The runtime has none: the artifacts contain only
> Node's own modules.

### 2) Install into the profile

```sh
dsh plugin --profile <your profile> add link:/absolute/path/dsh-enhance
dsh plugin --profile <your profile> add link:/absolute/path/dsh-enhance/packages/schedule
dsh plugin --profile <your profile> add link:/absolute/path/dsh-enhance/packages/session-unpack
dsh plugin --profile <your profile> add link:/absolute/path/dsh-enhance/packages/notify
```

The component packages declare no `dsh.bundle` and are installed as plain dependencies; the Host
says so while it loads the profile and reconciles the dependencies, not while `add` runs. That is expected:
a component package must not become a profile layer of its own, or it would show up as a separate plugin.
The bundle's patch rows find them by package name.

Requires dsh **>= 0.2.2-rc.1** (declared in `engines.dsh`).

## Uninstall

`dsh plugin` forwards to pnpm and removes one dependency per call, so run all four:

```sh
dsh plugin --profile <your profile> remove dsh-enhance
dsh plugin --profile <your profile> remove dsh-enhance-schedule
dsh plugin --profile <your profile> remove dsh-enhance-session-unpack
dsh plugin --profile <your profile> remove dsh-enhance-notify
```

With only the first command, the three component packages stay in the profile's `node_modules` as plain
dependencies: nothing in the composition tree refers to them any more, but the files stay on disk.

## Develop

> A separate guide describes the **one bundle, several independently switchable components** pattern:
> how to lay it out, how to install it, and the traps it comes with — [`docs/multi-component-bundle.md`](./docs/multi-component-bundle.md)
> (written in Chinese).

```sh
npm run bundle                     # build all three components into lib/

node --check packages/schedule/src/client/index.js
node --check packages/schedule/src/index.js
node --check packages/session-unpack/src/index.js
node --check packages/session-unpack/src/session-unpack/index.js
node --check packages/notify/src/client/index.js

node --test tests/client-behavior.mjs
node --test tests/host-session-unpack.mjs
node --test tests/host-tool-registration.mjs
node --test tests/notify-behavior.mjs
```

None of the four test files needs a browser or a dsh process: the client tests load the built
`lib/client.js` — the very file the Host loads — through a React stand-in, the unpack tests build the
three artifact shapes on disk, the registration tests drive the registered tool through a fake
context — including the order in which it asks for permission and reads — and the reply-alert tests
drive the browser half through a browser stand-in, covering the configuration-page registration
(`plugins.row.config`), the composer dock left alone, the running-state edge, the toast that waits for
a backgrounded window, the two switches and where they are remembered, and the four tones in the picker
— that a picked tone is remembered and that it is the picked tone that plays.

## License

MIT
