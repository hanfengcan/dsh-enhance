# dsh-enhance-schedule (Automation task)

Create an automation task *for the conversation you are in*, from the composer dock, and open the
shipped right-Sidebar task page on it.

It is the first component of the [dsh-enhance](../../README.en.md) bundle, independent of *Session
unpack* and *Reply alerts*: turning it off leaves the other two working.

[中文](./README.md) | English

---

## What it is for

dsh's own "new automation task" editor can only target a *new* session (or a one-shot session): when
the task comes due, a new conversation goes and does the work. Many situations are not like that —
the plan's quota ran out, you are waiting for the next cycle, and you want the job queued **into the
conversation in front of you**, with the result landing in that same conversation.

This component adds that entry point: one "定时任务" pill in the dock under the input box, one form
(name / instruction / time), and the task is bound to the very session you are looking at. The typical
use is "continue the unfinished work here once the quota is back".

The task stays a native dsh automation task: it shows in the official Automation tasks panel, in the
Session header's task badge, and in the official right-Sidebar page where you can inspect, edit, run or
delete it. The plugin is only the **entry point for creating one**; it does not invent a second task
system.

## What makes it different

- **No ambiguity**: the entry sits in the current session's dock, so what it binds is the session on
  screen — there is no session picker, and it cannot bind to the wrong conversation.
- **The surface matches the shipped one**: the dialog is a port of the official task editor (row-shaped
  rules, run target / run time: repeat · interval · weekday · date · time · time zone), and creating a
  task lands on the official task detail page, where editing, running and deleting stay in the official
  UI.
- **It loads no Harness Client package**: the dialog, the button, the input, the dropdown, the month
  card and the clock card are the plugin's own copies of the shipped controls — same markup, same
  behaviour, this plugin's class names, the Host theme's tokens as the only styling dependency. So the
  component cannot fight the front-end packages of a given dsh version.
- **It does not patch dsh**: a pure plugin, so upgrading dsh needs no source patch.
- **No runtime dependencies**: the artifacts contain Node's own modules only; the source is built with
  tsdown into `lib/`.

## How to use it

1. Open any session;
2. Press the **「定时任务」** pill in the dock under the input box (the row that also carries the turn
   count and the token usage);
3. Fill in the **task name** and the **task instruction**, and pick the repeat rule, the date and the
   time;
4. Press *Create*.

The dialog's rows mirror the shipped "manual create" dialog:

- **Run target** — the current session (fixed: the task is created on the session in front of you);
- **Run time → Repeat** — Weekly / Monday to Friday / Every day / Every N hours / Every N minutes /
  Every month / Once / Custom;
- **Run time → Repeat interval** — present for every rule except *Once* and *Custom*; a stepper sets N;
- **Run time → Weekday** — appears for *Weekly*: seven pills, Monday first;
- **Run time → Date** — only for a one-shot task; a self-drawn month card;
- **Run time → Time** — a self-drawn hour / minute / second clock card; *Every day* stops at minutes,
  as in the shipped editor;
- **Run time → Time zone** — a searchable menu, defaulting to the machine's zone.

The shipped behaviour of *greying out Create and staying quiet* is copied too: a red line appears at the
bottom of the dialog only when the Host actually refuses the creation.

After a successful creation the official right-Sidebar opens that task's detail page. When the task
comes due it delivers one execution to this session; to cancel it early, use *⋯ → 删除任务* in the
right-Sidebar page.

## What it is made of

| Part | Responsibility |
| --- | --- |
| `src/client/index.js` | Register the dock entry, the access gate, the creation request and the right-Sidebar page |
| `src/client/components/dock-entry.js` | The pill in the dock under the input box |
| `src/client/components/create-task-dialog.js` | The creation dialog |
| `src/client/components/task-editor.js` | The form body: the repeat row, the rows the chosen frequency adds, the time-zone row |
| `src/client/components/rule-rows.js` | The repeat / interval / weekday / date / time / time-zone rows |
| `src/client/components/date-picker.js` | The self-drawn month card |
| `src/client/components/clock-picker.js` | The self-drawn hour / minute / second clock card |
| `src/client/components/primitives.js` | The plugin's own buttons, inputs and menus |
| `src/client/schedule-format.js` | Turning the form's rules into one DTSTART and one RRULE |
| `src/client/time-zones.js` | The current minute in the selected zone, the anchor for a minute or hour interval |
| `src/client/icons.js` | Drawing product icons from the Host's sprite symbols |
| `src/client/id-counter.js` | Minting unique ids for the controls the rule rows label themselves with |
| `src/client/hooks.js` | Keyboard focus management inside the dialog |
| `src/client/locales.js` | This component's copy |
| `src/client/styles.js` | This component's own skin, `--dsw-*` theme tokens only |
| `src/index.js` | Host half (empty entry; browser code must not run in Node) |

Decisions worth naming:

- **The entry uses the composer-dock slot** (`conversation.composer.dock`): that row already carries the
  current session's statistics (turn count, token usage), so it comes with the session's identity —
  no extra "current session" API is needed.
- **It registers under a new id** (`dsh-enhance-schedule-task`, order 2, after the shipped
  `activity`/`usage`), so it **adds** a control instead of replacing a shipped one.
- **The gate is `ctx.remoteAccess.whenAccess('schedule/create', …)` plus the component's own
  `useRemoteAccess('schedule/create')`**: `schedule/create` is an owner-only global resource endpoint,
  so a peer other than the owner never sees this entry.
- **The form is a port of the shipped rule rows**: field names, row layout, radii and theme tokens
  follow the official task editor (`--dsw-alias-*`); the controls are local copies, not imports.
- **Timing rules are RFC 5545 text**, `DTSTART;TZID=<local zone>:…` + `RRULE:`, the same shape the
  shipped dsh editor writes: *Once* = `FREQ=DAILY;COUNT=1`; *Every day* =
  `FREQ=DAILY;INTERVAL=n;BYHOUR=…;BYMINUTE=…`; *Weekly* = `FREQ=WEEKLY;INTERVAL=n;BYDAY=MO,TU,…`;
  *Every month* = `FREQ=MONTHLY;INTERVAL=n;BYMONTHDAY=d,-1;BYSETPOS=1`; *Every N hours / minutes* =
  `FREQ=HOURLY|MINUTELY;INTERVAL=n`; *Custom* is passed through verbatim.
- **A successful creation opens the official page**: `ctx.sidebarRight.openTab('scheduleTask',
  { params: { sessionId, id } })`, so what opens is that task's own detail page, not a panel of our own.
- **A failed form keeps the draft** and turns the reason into one sentence (the time is not in the
  future / the rule is invalid / a generic failure).
- **The dialog does not join the official global modal stack**: it is drawn by the plugin, so it only
  competes for Escape and Tab with *its own* dropdowns; the shipped "close the topmost dialog"
  shortcut does not close it (Escape inside the dialog works).
- **Most icons reference the Host's sprite symbols** (`dsw-icon-clock-outline-regular` and friends): a
  theme that replaces the artwork replaces it here too, and the plugin ships no art of its own. If the
  Host renames a symbol, the plugin's icon goes blank. The one exception is the **calendar icon** of
  the date row: the shipped product icon set has no calendar glyph, the official editor draws its own,
  and the plugin copies that path along with it.
- **The repeat rules are the shipped ones**: the eight frequencies, the interval stepper, the weekday
  pills, the custom-rule text and each frequency's RRULE spelling all follow the official
  `editor-timing.ts` line by line; nothing was narrowed down.

## Host contracts it depends on

- the `conversation.composer.dock` slot;
- the `remote.schedule.create` endpoint (through the `schedule/create` gate of `ctx.remoteAccess`);
- the `sidebarRight.openTab('scheduleTask')` page kind.

If the Host changes any of the three, this component has to follow.

## Build and test

```sh
cd packages/schedule
npm install
npm run bundle          # output in lib/ (not tracked)
```

The test lives in the repository root:

```sh
node --test tests/client-behavior.mjs
```

It loads the built `lib/client.js` — the very file the Host loads — through a React stand-in, and
covers the entry's registration arguments, the access gate, the target session of the creation request,
the mapping of failure reasons, the right-Sidebar parameters, the RRULE payload of each of the eight
frequencies, the rows matching the shipped form, the options and the selected mark of the repeat menu,
the date and time rows being self-drawn buttons instead of native controls, the month card and the
three-column clock card, *Every day* carrying no seconds, and the hard constraint that the component
loads no Harness Client package.

## License

MIT
