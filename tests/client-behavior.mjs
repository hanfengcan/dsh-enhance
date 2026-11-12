/**
 * Behaviour of the browser half, without a browser.
 *
 * The client artifact is a module-loader file: it registers a factory that
 * the shell instantiates. This test loads that file the way the shell does —
 * a `window.__ModuleLoader__.load` call and a `require` that answers the
 * browser module table — and then drives the registration, the creation
 * request, and the page it opens.
 *
 * The artifact owns its own controls, so the stub answers `react` and
 * `react-dom` only: the plugin loads no Harness Client package.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * A React stand-in: elements are plain records, function components run as
 * soon as they are created, and `useState` reads a preset so a form can be
 * rendered in a chosen state.
 *
 * The preset is keyed by component name and lists that component's state
 * values in call order, so one component's states cannot shift another's.
 * Every state setter is recorded, so a test can read what an edit staged.
 * @param preset - State values per component name.
 * @returns The React stub.
 */
function stubReact(preset = {}) {
  const stack = []
  const cursors = new Map()
  const react = {
    /** Every staged state change, in the order the components made them. */
    updates: [],
    createElement(type, props, ...children) {
      const merged = {
        ...(props ?? {}),
        children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
      }
      if (typeof type !== 'function') return { type, props: merged }
      stack.push(type.name)
      try {
        return type(merged, ...children)
      } finally {
        stack.pop()
      }
    },
    Fragment: 'Fragment',
    useMemo: (factory) => factory(),
    useRef: () => ({ current: null }),
    useCallback: (callback) => callback,
    // The effects reach for the document and the window; the stub has neither
    // mounted, so they do nothing.
    useEffect: () => {},
    useLayoutEffect: () => {},
    useState(initial) {
      const name = stack[stack.length - 1] ?? '(root)'
      const values = preset[name]
      const index = cursors.get(name) ?? 0
      cursors.set(name, index + 1)
      const value = values !== undefined && index < values.length
        ? values[index]
        : (typeof initial === 'function' ? initial() : initial)
      return [value, (next) => { react.updates.push({ name, next }) }]
    },
    /**
     * Render one registered component as the shell would.
     * @param component - The component the slot renders.
     * @param props - The props the slot passes.
     * @returns The rendered tree.
     */
    render(component, props) {
      stack.push(component.name)
      try {
        return component(props)
      } finally {
        stack.pop()
      }
    },
  }
  return react
}

/**
 * Load the client artifact and instantiate its plugin.
 * @param react - The React stand-in the artifact receives.
 * @returns The plugin object the factory produced.
 */
async function loadPlugin(react) {
  let spec
  globalThis.window = {
    __ModuleLoader__: {
      load(loaded) {
        spec = loaded
      },
    },
  }
  // The artifact installs one stylesheet and portals two layers into the
  // document body; the stub document accepts and drops them.
  globalThis.document = {
    createElement: () => ({ id: '', dataset: {}, textContent: '', remove() {} }),
    head: { append() {} },
    body: {},
  }
  const source = await readFile(new URL('../packages/schedule/lib/client.js', import.meta.url), 'utf8')
  const require_ = (id) => {
    if (id === 'react') return react
    if (id === 'react-dom') return { createPortal: (children) => children }
    throw new Error(`unexpected module request: ${id}`)
  }
  // eslint-disable-next-line no-new-func -- the artifact is a browser script
  new Function('window', 'require', source)(globalThis.window, require_)
  assert.ok(spec !== undefined, 'the artifact registered no module')
  assert.equal(spec.id, 'dsh-enhance-schedule', 'the module id is the package name')
  return spec.factory(require_)
}

/**
 * A context that records what the plugin registers and asks for.
 * @param options - The answers the stub services give.
 * @returns The stub context and the recorded calls.
 */
function stubContext(options = {}) {
  const calls = { create: [], openTab: [], registered: [], locales: [], effects: 0 }
  const ctx = {
    effect(disposer) {
      calls.effects += 1
      const value = disposer()
      return () => { if (typeof value === 'function') value() }
    },
    locale: {
      register(namespace, dictionaries) {
        calls.locales.push({ namespace, dictionaries })
        return () => {}
      },
      getSnapshot() {
        return { active: options.locale ?? 'zh' }
      },
    },
    remoteAccess: {
      whenAccess(action, callback) {
        calls.access = action
        const produced = callback()
        if (typeof produced === 'function') return produced
        // The guard answers with one disposer or an iterable of them; a
        // generator body only runs while it is iterated.
        if (produced !== null && typeof produced === 'object' && typeof produced[Symbol.iterator] === 'function') {
          const disposers = [...produced]
          return () => { disposers.reverse().forEach(dispose => dispose?.()) }
        }
        return () => {}
      },
    },
    slots: {
      inject(name, register) {
        const disposer = register()
        return disposer
      },
      register(registration, component) {
        calls.registered.push({ registration, component })
        return () => {}
      },
    },
    remote: {
      schedule: {
        create: async (request) => {
          calls.create.push(request)
          if (options.createResult !== undefined) return options.createResult
          return { ok: true, value: { id: 'schedule-1' } }
        },
      },
    },
    sidebarRight: {
      openTab(kind, openOptions) {
        calls.openTab.push({ kind, options: openOptions })
      },
    },
  }
  return { ctx, calls }
}

/**
 * Walk an element tree, visiting both children and a menu's anchor.
 * @param node - The tree root.
 * @param visit - Called for every element.
 * @returns Nothing.
 */
function walk(node, visit) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach(child => { walk(child, visit) })
    return
  }
  visit(node)
  walk(node.props?.children, visit)
  walk(node.props?.anchor, visit)
}

/**
 * Walk an element tree for every element of one type.
 * @param node - The tree root.
 * @param type - The tag name to collect.
 * @returns The matching elements.
 */
function findAll(node, type) {
  const found = []
  walk(node, current => { if (current.type === type) found.push(current) })
  return found
}

/**
 * Walk an element tree for every element carrying one attribute.
 * @param node - The tree root.
 * @param name - The attribute name.
 * @returns The matching elements.
 */
function findByAttr(node, name) {
  const found = []
  walk(node, current => {
    if (current.props !== undefined && current.props !== null && current.props[name] !== undefined) found.push(current)
  })
  return found
}

/**
 * Walk an element tree for every element wearing one class.
 * @param node - The tree root.
 * @param className - The class to collect.
 * @returns The matching elements.
 */
function findByClass(node, className) {
  return findByAttr(node, 'className').filter(element => {
    const value = element.props.className
    return typeof value === 'string' && value.split(' ').includes(className)
  })
}

/**
 * The text of every rule row label in one tree.
 * @param node - The tree root.
 * @returns The label texts, in order.
 */
function rowLabels(node) {
  return findByClass(node, 'dsh-enhance-ruleLabel')
    .map(element => element.props.children)
}

/**
 * The button of the footer that carries one action id.
 * @param node - The tree root.
 * @param action - The action id, e.g. `create`.
 * @returns The button element.
 */
function actionButton(node, action) {
  const found = findByAttr(node, 'data-session-schedule-action')
    .filter(element => element.props['data-session-schedule-action'] === action)
  assert.equal(found.length, 1, `one ${action} button is offered`)
  return found[0]
}

/**
 * A local wall-clock moment some days ahead of now.
 * @param days - How many days ahead the moment is.
 * @returns The `YYYY-MM-DD` date and the `HH:MM` clock time.
 */
function momentAhead(days) {
  const moment = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const local = new Date(moment.getTime() - moment.getTimezoneOffset() * 60 * 1000)
  const stamp = local.toISOString()
  return { date: stamp.slice(0, 10), time: stamp.slice(11, 16) }
}

/**
 * The rule draft the shipped editor stages: the guided timing values, the
 * task's name, and its instruction.
 * @param overrides - The values that differ from the default.
 * @returns The draft object.
 */
function draft(overrides = {}) {
  const ahead = momentAhead(7)
  return {
    frequency: 'once',
    interval: '1',
    start: `${ahead.date}T${ahead.time}:00`,
    timeZone: 'Asia/Shanghai',
    rrule: '',
    weekdays: [1],
    monthDay: Number(ahead.date.slice(8, 10)),
    dailyTime: ahead.time,
    title: '继续当前未完成的工作',
    prompt: '继续吧',
    ...overrides,
  }
}

/**
 * Render the registered entry with the given form state.
 * @param react - The React stand-in.
 * @param calls - The recorded calls of the stub context.
 * @param options - The form state and the access answer.
 * @returns The rendered tree and the form's face.
 */
function renderEntry(react, calls, options = {}) {
  const { component, registration } = calls.registered[0]
  const face = registration.inject()
  const tree = react.render(component, {
    sessionId: options.sessionId ?? 'session-a',
    createTask: face.createTask,
    openTask: face.openTask,
    useRemoteAccess: options.useRemoteAccess ?? (() => true),
    readLocaleId: face.readLocaleId,
    t: (key) => key,
  })
  return { tree, face }
}

/**
 * The dialog of one rendered entry.
 * @param tree - The rendered tree.
 * @returns The dialog's card element.
 */
function dialogOf(tree) {
  const cards = findByClass(tree, 'dsh-enhance-modal-card')
  assert.equal(cards.length, 1, 'the entry opens one dialog')
  return cards[0]
}

/**
 * Render one entry whose form carries one draft.
 * @param options - The draft and the rule rows that are open.
 * @returns The stub, the recorded calls, and the dialog.
 */
async function renderDraft(options = {}) {
  const react = stubReact({
    SessionScheduleDockEntry: [true],
    CreateTaskDialog: [options.draft ?? draft(), false, null],
    TaskEditorFields: [options.dateOpen ?? false, options.clockOpen ?? false],
    RuleSelectRow: options.menuOpen === undefined ? [] : [options.menuOpen],
  })
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)
  const { tree } = renderEntry(react, calls)
  return { react, calls, dialog: dialogOf(tree) }
}

/**
 * The text one rule row's current value shows.
 * @param dialog - The dialog element.
 * @param index - Which rule row to read.
 * @returns The current value text.
 */
function currentValue(dialog, index = 0) {
  const triggers = findByClass(dialog, 'dsh-enhance-ruleValue')
  const face = triggers[index].props.children[2]
  return face.props.children[0].props.children
}

/**
 * The buttons of the Date and Time rows.
 * @param dialog - The dialog element.
 * @returns The picker trigger buttons.
 */
function pickerButtons(dialog) {
  return findByClass(dialog, 'dsh-enhance-pickerTrigger')
}

/**
 * The text one picker trigger shows.
 * @param button - The trigger element.
 * @returns The shown text.
 */
function triggerText(button) {
  return button.props.children[0].props.children
}

/**
 * The glyph one picker trigger wears.
 * @param button - The trigger element.
 * @returns The glyph element.
 */
function triggerGlyph(button) {
  return button.props.children[1]
}

test('the artifact loads no Harness Client package', async () => {
  const source = await readFile(new URL('../packages/schedule/lib/client.js', import.meta.url), 'utf8')
  const harnessImports = source.match(/@deepseek-ai\/dsh-client-[a-z-]+/g) ?? []
  assert.deepEqual(harnessImports, [], 'the plugin owns its own controls')
})

test('the artifact asks the shell for react and react-dom only', async () => {
  const source = await readFile(new URL('../packages/schedule/lib/client.js', import.meta.url), 'utf8')
  const modules = [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(match => match[1])
  assert.deepEqual([...new Set(modules)].sort(), ['react', 'react-dom'])
})

test('the artifact registers one composer-dock entry behind the schedule/create access', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()

  plugin.apply(ctx)

  assert.equal(calls.effects, 2, 'the dictionaries and the stylesheet are effects')
  assert.deepEqual(calls.locales.map(entry => entry.namespace), ['dsh.enhance.schedule'])
  assert.equal(calls.access, 'schedule/create', 'the entry answers to the create action')
  assert.equal(calls.registered.length, 1, 'one contribution')
  const { registration } = calls.registered[0]
  assert.equal(registration.name, 'conversation.composer.dock')
  assert.equal(registration.id, 'dsh-enhance-schedule-task')
  assert.equal(registration.order, 2, 'after the shipped statistics pills')
  assert.equal(registration.locale, 'dsh.enhance.schedule')
})

test('the dock entry is a pill that names the conversation it sits in', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { tree } = renderEntry(react, calls)

  const pill = findByAttr(tree, 'data-session-schedule')
  assert.equal(pill.length, 1, 'one entry is offered')
  assert.equal(pill[0].props['data-session-schedule'], 'session-a', 'the entry names its Session')
  assert.equal(pill[0].props.type, 'button', 'the entry is a button')
  const stat = findByAttr(tree, 'data-composer-stat')
  assert.equal(stat[0].props['data-composer-stat'], 'session-schedule', 'the entry carries its dock id')
  const glyphs = findByAttr(tree, 'data-icon')
  assert.equal(glyphs.length, 1, 'the entry wears one glyph')
  assert.equal(glyphs[0].props['data-icon'], 'dsw-icon-clock-outline-regular', 'the glyph is the Host sprite symbol')
})

test('the entry asks the Host for a task bound to its own Session', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const face = calls.registered[0].registration.inject()
  const outcome = await face.createTask({
    title: '继续当前未完成的工作',
    prompt: '继续吧',
    timing: { kind: 'rrule', rrule: 'DTSTART;TZID=Asia/Shanghai:20261112T090000\nRRULE:FREQ=DAILY;COUNT=1' },
    target: { kind: 'session', sessionId: 'session-a' },
  })

  assert.deepEqual(calls.create[0].target, { kind: 'session', sessionId: 'session-a' })
  assert.deepEqual(outcome, { created: { id: 'schedule-1' } })
})

test('a refused creation names its reason', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext({
    createResult: { ok: false, error: { code: 'schedule/input-invalid', details: { code: 'not_future' } } },
  })
  plugin.apply(ctx)

  const face = calls.registered[0].registration.inject()
  const outcome = await face.createTask({ title: 't', prompt: 'p' })
  assert.deepEqual(outcome, { failed: 'notFuture' })
})

test('a created task opens the shipped task page', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const face = calls.registered[0].registration.inject()
  face.openTask('session-a', 'schedule-1')

  assert.deepEqual(calls.openTab, [{
    kind: 'scheduleTask',
    options: { params: { sessionId: 'session-a', id: 'schedule-1' } },
  }])
})

test('the entry stays hidden while the Peer may not create a task', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { tree } = renderEntry(react, calls, { useRemoteAccess: () => false })

  assert.equal(findByAttr(tree, 'data-session-schedule').length, 0, 'no entry is offered')
})

test('the form mirrors the shipped task editor rows', async () => {
  const { dialog } = await renderDraft({ draft: draft({ frequency: 'once' }) })

  assert.deepEqual(rowLabels(dialog), [
    'target', 'repeat', 'date', 'time', 'zone',
  ], 'the rows name the target, the repeat and the run time')
})

test('the repeat row opens a menu of the eight shipped choices', async () => {
  const { dialog } = await renderDraft({ menuOpen: true })

  const lists = findByClass(dialog, 'dsh-enhance-menu-list')
  assert.equal(lists.length, 1, 'the repeat row opens one list')
  assert.equal(lists[0].props.role, 'menu', 'the list is a menu')
  const rows = findByAttr(dialog, 'data-session-schedule-menu-item')
  assert.deepEqual(rows.map(row => row.props['data-session-schedule-menu-item']), [
    'weekly', 'weekdays', 'daily', 'hourly', 'minutely', 'monthly', 'once', 'advanced',
  ], 'the eight choices keep the shipped order')
  const chosen = rows.find(row => row.props['data-session-schedule-menu-item'] === 'once')
  const checks = findByAttr(chosen, 'data-icon')
  assert.equal(checks.length, 1, 'the chosen row carries a check')
  assert.equal(checks[0].props['data-icon'], 'dsw-icon-check-outline-regular')
})

test('the repeat row names the chosen frequency', async () => {
  const { dialog } = await renderDraft({ draft: draft({ frequency: 'daily' }) })
  assert.equal(currentValue(dialog), 'frequencyDaily', 'a daily rule reads as every day')

  const weekdays = await renderDraft({ draft: draft({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] }) })
  assert.equal(currentValue(weekdays.dialog), 'frequencyWeekdays', 'Monday to Friday reads as itself')

  const weekly = await renderDraft({ draft: draft({ frequency: 'weekly', weekdays: [1, 3] }) })
  assert.equal(currentValue(weekly.dialog), 'frequencyWeekly', 'other weekday sets read as weekly')
})

test('each frequency shows the rows it owns', async () => {
  const rows = {
    once: ['target', 'repeat', 'date', 'time', 'zone'],
    weekly: ['target', 'repeat', 'interval', 'weekday', 'time', 'zone'],
    daily: ['target', 'repeat', 'interval', 'time', 'zone'],
    hourly: ['target', 'repeat', 'interval', 'zone'],
    minutely: ['target', 'repeat', 'interval', 'zone'],
    monthly: ['target', 'repeat', 'interval', 'monthDay', 'time', 'zone'],
    advanced: ['target', 'repeat'],
  }
  for (const [frequency, expected] of Object.entries(rows)) {
    const { dialog } = await renderDraft({ draft: draft({ frequency }) })
    assert.deepEqual(rowLabels(dialog), expected, `the ${frequency} rule owns these rows`)
  }
})

test('a custom rule adds its own field and its own time zone row', async () => {
  const { dialog } = await renderDraft({ draft: draft({ frequency: 'advanced', rrule: '0 9 * * *' }) })

  assert.deepEqual(rowLabels(dialog), ['target', 'repeat', 'zone'], 'a cron text names a zone')
  const fields = findByClass(dialog, 'dsh-enhance-instruction')
  assert.equal(fields.length, 2, 'the instruction and the custom rule both own a text box')
})

test('the time row shows seconds, except for a daily rule', async () => {
  const once = await renderDraft({ draft: draft({ frequency: 'once', start: '2026-11-18T12:44:07' }) })
  const timeText = triggerText(pickerButtons(once.dialog)[1])
  assert.equal(timeText, '12:44:07', 'a one-shot rule names its seconds')

  const daily = await renderDraft({ draft: draft({ frequency: 'daily', dailyTime: '12:44' }) })
  assert.equal(triggerText(pickerButtons(daily.dialog)[0]), '12:44', 'a daily rule names hour and minute')
})

test('the date and time rows are self-drawn buttons, not native inputs', async () => {
  const { dialog } = await renderDraft({ draft: draft({ frequency: 'once' }) })

  const natives = findAll(dialog, 'input').filter(element => element.props.type === 'date' || element.props.type === 'time')
  assert.deepEqual(natives, [], 'no native date or time field is offered')

  const [date, time] = pickerButtons(dialog)
  assert.equal(date.props.type, 'button', 'the date row opens a card from a button')
  assert.equal(time.props.type, 'button', 'the time row opens a card from a button')
  assert.equal(triggerText(date), momentAhead(7).date.replace(/-/g, '/'), 'the date reads as YYYY/MM/DD')
  assert.equal(triggerGlyph(date).props.viewBox, '0 0 14 14', 'the date wears the shipped calendar glyph')
  assert.equal(triggerGlyph(time).props['data-icon'], 'dsw-icon-clock-outline-regular', 'the time wears the Host clock glyph')
})

test('the month card draws the shipped calendar', async () => {
  const { dialog } = await renderDraft({
    draft: draft({ frequency: 'once' }),
    dateOpen: true,
  })

  const cells = findByClass(dialog, 'dsh-enhance-calendarCell')
  assert.ok(cells.length >= 28, 'the card draws a month of days')
  const selected = cells.filter(cell => cell.props['aria-selected'] === true)
  assert.equal(selected.length, 1, 'one day is selected')
  const weekdays = findByClass(dialog, 'dsh-enhance-calendarWeekday')
  assert.equal(weekdays.length, 7, 'the card names the seven weekdays')
})

test('the clock card draws the three shipped columns', async () => {
  const { dialog } = await renderDraft({
    draft: draft({ frequency: 'once' }),
    clockOpen: true,
  })

  const columns = findByClass(dialog, 'dsh-enhance-clockColumn')
  assert.equal(columns.length, 3, 'hours, minutes and seconds each own a column')
  const options = findByClass(dialog, 'dsh-enhance-clockOption')
  assert.equal(options.length, 24 + 60 + 60, 'every clock value is offered')
})

test('a daily rule offers a clock card without seconds', async () => {
  const { dialog } = await renderDraft({
    draft: draft({ frequency: 'daily', dailyTime: '12:44' }),
    clockOpen: true,
  })

  const columns = findByClass(dialog, 'dsh-enhance-clockColumn')
  assert.equal(columns.length, 2, 'a daily rule names only its hour and minute')
})

test('the form sends the name, the instruction, the rule and the Session', async () => {
  const { calls, dialog } = await renderDraft({ draft: draft({ frequency: 'once' }) })

  actionButton(dialog, 'create').props.onClick()

  assert.equal(calls.create.length, 1)
  const request = calls.create[0]
  assert.equal(request.title, '继续当前未完成的工作')
  assert.equal(request.prompt, '继续吧')
  assert.deepEqual(request.target, { kind: 'session', sessionId: 'session-a' })
  assert.equal(request.timing.kind, 'rrule')
  assert.match(
    request.timing.rrule,
    /^DTSTART;TZID=Asia\/Shanghai:\d{8}T\d{6}\nRRULE:FREQ=DAILY;COUNT=1$/,
  )
})

test('every frequency spells its own rule', async () => {
  const cases = [
    [{ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] }, 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR'],
    [{ frequency: 'weekly', weekdays: [3] }, 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE'],
    [{ frequency: 'daily', dailyTime: '18:30' }, 'RRULE:FREQ=DAILY;INTERVAL=1;BYHOUR=18;BYMINUTE=30'],
    [{ frequency: 'hourly', interval: '3' }, 'RRULE:FREQ=HOURLY;INTERVAL=3'],
    [{ frequency: 'minutely', interval: '5' }, 'RRULE:FREQ=MINUTELY;INTERVAL=5'],
    [{ frequency: 'monthly', monthDay: 18 }, 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=18,-1;BYSETPOS=1'],
    [{ frequency: 'once' }, 'RRULE:FREQ=DAILY;COUNT=1'],
  ]
  for (const [overrides, rule] of cases) {
    const { calls, dialog } = await renderDraft({ draft: draft(overrides) })
    actionButton(dialog, 'create').props.onClick()
    const rrule = calls.create[0].timing.rrule
    assert.equal(rrule.split('\n')[1], rule, `the ${overrides.frequency} rule reads as ${rule}`)
  }
})

test('a custom rule is passed on as it stands', async () => {
  const text = 'DTSTART;TZID=Asia/Shanghai:20261118T124400\nRRULE:FREQ=WEEKLY;BYDAY=MO'
  const { calls, dialog } = await renderDraft({ draft: draft({ frequency: 'advanced', rrule: text }) })

  actionButton(dialog, 'create').props.onClick()

  assert.equal(calls.create[0].timing.kind, 'rrule')
  assert.equal(calls.create[0].timing.rrule, text, 'the text reaches the Host unchanged')
})

test('a custom cron text is passed on as a cron rule', async () => {
  const { calls, dialog } = await renderDraft({ draft: draft({ frequency: 'advanced', rrule: '0 9 * * *' }) })

  actionButton(dialog, 'create').props.onClick()

  assert.equal(calls.create[0].timing.kind, 'cron')
  assert.equal(calls.create[0].timing.cron.expression, '0 9 * * *')
  assert.equal(calls.create[0].timing.cron.time_zone, 'Asia/Shanghai')
})

test('a weekday pill toggles one weekday in the rule', async () => {
  const { react, dialog } = await renderDraft({ draft: draft({ frequency: 'weekly', weekdays: [1, 3] }) })

  const pills = findByAttr(dialog, 'aria-pressed')
  assert.equal(pills.length, 7, 'the week offers one pill per weekday')
  assert.deepEqual(pills.map(pill => pill.props['aria-pressed']), [true, false, true, false, false, false, false])

  pills[4].props.onClick()
  const staged = react.updates.find(update => update.name === 'CreateTaskDialog')
  assert.ok(staged, 'the edit staged a new draft')
  const next = typeof staged.next === 'function' ? staged.next(draft({ frequency: 'weekly', weekdays: [1, 3] })) : staged.next
  assert.deepEqual(next.weekdays, [1, 3, 5], 'the tapped weekday joined the rule')
})

test('the time zone row names the zone it stores', async () => {
  const { dialog } = await renderDraft({ draft: draft({ timeZone: 'Asia/Shanghai' }) })

  const zoneRow = findByClass(dialog, 'dsh-enhance-ruleValue')[1]
  const value = zoneRow.props.children[2].props.children[0].props.children
  // The stub's translator answers with the key, so the copy shows as
  // `utcPrefix+08:00 · <the ICU name>zoneSystem`.
  assert.match(value, /^utcPrefix\+08:00 · .+zoneSystem$/)
})

test('the dictionaries carry the shipped copy', async () => {
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { zh, en } = calls.locales[0].dictionaries
  assert.deepEqual(
    [
      zh.frequencyWeekly, zh.frequencyWeekdays, zh.frequencyDaily, zh.frequencyHourly,
      zh.frequencyMinutely, zh.frequencyMonthly, zh.frequencyOnce, zh.frequencyAdvanced,
    ],
    ['每周', '周一至周五', '每天', '每 N 小时', '每 N 分钟', '每月', '仅一次', '自定义'],
    'the eight repeat choices keep the shipped Chinese copy',
  )
  assert.deepEqual(
    [
      en.frequencyWeekly, en.frequencyWeekdays, en.frequencyDaily, en.frequencyHourly,
      en.frequencyMinutely, en.frequencyMonthly, en.frequencyOnce, en.frequencyAdvanced,
    ],
    ['Weekly', 'Monday to Friday', 'Every day', 'Every N hours', 'Every N minutes', 'Every month', 'Once', 'Custom'],
    'the eight repeat choices keep the shipped English copy',
  )
  assert.equal(zh.ruleTitle, '运行时间')
  assert.equal(zh.target, '执行位置')
  assert.equal(zh.targetCurrent, '当前关联会话')
  assert.equal(zh.zoneSystem, '（系统）')
})

test('an incomplete form does not reach the Host', async () => {
  const { calls, dialog } = await renderDraft({ draft: draft({ title: '', prompt: '' }) })

  const create = actionButton(dialog, 'create')
  assert.equal(create.props.disabled, true, 'the create button stays disabled')
  create.props.onClick()
  assert.equal(calls.create.length, 0, 'nothing was sent')
  assert.equal(
    findByClass(dialog, 'dsh-enhance-error').length,
    0,
    'the shipped form states no local hint; only the Host reports a refusal',
  )
})

test('a moment in the past is the Host\'s refusal, not a local one', async () => {
  const past = momentAhead(-7)
  const { calls, dialog } = await renderDraft({
    draft: draft({ frequency: 'once', start: `${past.date}T${past.time}:00` }),
  })

  const create = actionButton(dialog, 'create')
  assert.equal(create.props.disabled, false, 'the shipped form lets the Host judge the moment')
  create.props.onClick()
  assert.equal(calls.create.length, 1, 'the request reached the Host')
})
