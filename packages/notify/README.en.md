# dsh-enhance-notify (Reply alerts)

A sound when a reply finishes: **a chime**, plus — while the window is in the background —
**a system notification**.

It is the third component of the [dsh-enhance](../../README.en.md) bundle, independent of *Automation
task* and *Session unpack*: turning it off leaves the other two working.

[中文](./README.md) | English

---

## What it is for

dsh never says "this turn is done". Work in another window and you come back guessing; on the desktop
it is worse — a minimized window shows nothing at all.

This component answers a finished turn with a **chime**, and — while the window is in the background
(another app, minimized, or a different browser tab) — with a **system notification**, which is a Windows
toast. Clicking the toast brings the window back to the front.

## How to use it

The settings live on the **Plugins page**, not in the composer dock:

1. Open the Plugins page, go into *DSH enhancements*;
2. In *Included components* find *Reply alerts* and press *Configure* on that row;
3. The page that opens carries:

- **Chime** — play a chime when a reply finishes (switch);
- **Tone** — one of four synthesized tones: *Chime* (two partials, a short ding), *Bell* (a fundamental
  plus three partials), *Pulse* (two low pulses), *Wave* (three rising notes). All four are
  synthesized on the spot with Web Audio — no audio file ships;
- **System notification** — raise a toast while the window is in the background (switch; the browser's
  Notification API, a native toast on Windows);
- **Preview tone** — hear the tone you picked, once.

The switches and the tone live in this browser's `localStorage` under `dsh.enhance.notify`; another
workstation starts from the defaults.

The Configure entry is the Host's own seat for a component's configuration (`plugins.row.config`),
keyed by `<bundle package>#<component id>`. It appears while the component is enabled and leaves with it.

## How it knows a turn ended

The Host forwards `api-session/status` whenever an Agent changes running state (`sessionId, running`).
The component remembers which sessions are running: it records `true`, and a `false` for a session it
had seen running **is** a finished turn. A `false` without a preceding `true` (the initial state on
connect, a recycled Agent) is not one.

A subagent's own turn does not count — the user is waiting on the current conversation.

## What it is made of

| Part | Responsibility |
| --- | --- |
| `src/client/index.js` | Subscribe to `api-session/status`, detect the finished turn, register the configuration page |
| `src/client/tones.js` | The pitch and timing table of the four tones |
| `src/client/chime.js` | Web Audio synthesis and playback (partials, per-note decay) |
| `src/client/system-notification.js` | The system notification (Notification API) and the permission notice |
| `src/client/settings.js` | The preferences in `localStorage` (switches + tone) |
| `src/client/components/settings-page.js` | The settings page on the Plugins page (own switch and tone picker) |
| `src/client/styles.js` | This page's own skin, `--dsw-*` theme tokens only |
| `src/index.js` | Host half (empty entry; browser code must not run in Node) |

A few decisions worth knowing:

- **Every tone is synthesized**: no audio file ships. The four tones are a pitch table in `tones.js`
  plus oscillators and envelopes in `chime.js`. The package stays small and tones are cheap to add.
- **Picking a tone previews it**: the tone you pick plays once on the spot, what gets remembered is the
  tone you picked, and that is the one a finished turn plays.
- **The settings live in the browser, not in the profile**: a chime is a habit of one machine, not a fact
  of the deployment; `localStorage` also keeps the component free of the schema dependency a profile
  setting would need.
- **The browser half imports no Harness Client package**: the switch and the picker are drawn here, with
  the Host's theme tokens and sprite symbols as the only styling dependency, so the component cannot
  fight the front-end packages of a given dsh version.
- **The toast only appears while the window is unfocused**: a toast for a reply you are watching is
  noise, not a signal.

## Host contracts it depends on

- the `api-session/status` state event (`sessionId, running`);
- the `plugins.row.config` configuration seat.

If the Host changes either of them, this component has to follow.

## Known limits

- **The first chime needs one user interaction** (the browser's autoplay policy); the component unlocks
  the audio context on the first pointer or key event, so it works after a normal session.
- **The notification permission belongs to the browser** and is asked for with the first toast. If it is
  denied, the component points at the site settings.
- **The toast only appears while the window is unfocused** — a toast for a reply you are watching is
  noise, not a signal.
- **It only listens to state events**: it knows *that* a turn ended, not what it said — the toast names
  the session, it does not carry the reply.

## Build and test

```sh
cd packages/notify
npm install
npm run bundle          # output in lib/ (not tracked)
```

The test lives in the repository root:

```sh
node --test tests/notify-behavior.mjs
```

It covers the configuration-page registration (`plugins.row.config`, keyed `<bundle>#<component id>`),
the composer dock left alone, the two switches on the page, the **running-state edge** counting as a
finished turn, a subagent turn not counting, the **toast waiting for a backgrounded window**, the two
switches silencing sound and toast, where the switches are remembered, and the four tones in the picker
— that a picked tone is remembered and that it is the picked tone that plays.

## License

MIT
