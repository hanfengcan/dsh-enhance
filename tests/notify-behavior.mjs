/**
 * Behaviour of the reply-alert browser half, without a browser.
 *
 * The artifact is a module-loader file: it registers a factory that the shell
 * instantiates. This test loads that file the way the shell does — a
 * `window.__ModuleLoader__.load` call and a `require` that answers the browser
 * module table — and then drives the Session status subscription the component
 * installs.
 *
 * The artifact owns its own controls, so the stub answers `react` and
 * `react-dom` only: the plugin loads no Harness Client package.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * A React stand-in: elements are plain records and function components run as
 * soon as they are created.
 * @param preset - State values per component name, so a test can open a menu
 *   the way a click would.
 * @returns The React stub.
 */
function stubReact(preset = {}) {
  const stack = []
  const cursors = new Map()
  return {
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
    useRef: (initial) => ({ current: initial }),
    useCallback: (callback) => callback,
    useEffect: () => {},
    useLayoutEffect: () => {},
    useState(initial) {
      const name = stack[stack.length - 1] ?? '(root)'
      const values = preset[name]
      const index = cursors.get(name) ?? 0
      cursors.set(name, index + 1)
      const presetValue = values === undefined ? undefined : values[index]
      const value = presetValue === undefined
        ? (typeof initial === 'function' ? initial() : initial)
        : presetValue
      return [value, () => {}]
    },
    /**
     * Render one registered component as the Plugins page would.
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
}

/**
 * A local storage stand-in, so the settings store can be exercised.
 * @returns The storage and the values it holds.
 */
function stubStorage() {
  const values = new Map()
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)) },
    removeItem: (key) => { values.delete(key) },
  }
}

/**
 * An audio context stand-in: every oscillator it creates is one note.
 * @returns The class and the record of the scheduled notes.
 */
function stubAudioContext() {
  const record = { notes: [] }
  class FakeAudioContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
    }

    createOscillator() {
      const note = { frequency: 0, started: false }
      record.notes.push(note)
      return {
        type: 'sine',
        frequency: { setValueAtTime: (value) => { note.frequency = value } },
        connect: () => {},
        start: () => { note.started = true },
        stop: () => {},
      }
    }

    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
      }
    }

    resume() { this.state = 'running'; return Promise.resolve() }

    close() { return Promise.resolve() }
  }
  return { FakeAudioContext, record }
}

/**
 * A Notification stand-in: every instance is one raised toast.
 * @param permission - The permission the browser holds.
 * @returns The class and the record of the raised toasts.
 */
function stubNotification(permission = 'granted') {
  const record = { shown: [] }
  class FakeNotification {
    static permission = permission

    static requestPermission() { return Promise.resolve(permission) }

    constructor(title, options) {
      record.shown.push({ title, options })
    }
  }
  return { FakeNotification, record }
}

/**
 * Walk an element tree, visiting every element.
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
}

/**
 * Walk an element tree for every element of one type.
 * @param node - The tree root.
 * @param type - The tag name to collect.
 * @returns the matching elements.
 */
function findAll(node, type) {
  const found = []
  walk(node, current => { if (current.type === type) found.push(current) })
  return found
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
    addEventListener() {},
    removeEventListener() {},
  }
  const source = await readFile(new URL('../packages/notify/lib/client.js', import.meta.url), 'utf8')
  const require_ = (id) => {
    if (id === 'react') return react
    if (id === 'react-dom') return { createPortal: (children) => children }
    throw new Error(`unexpected module request: ${id}`)
  }
  // eslint-disable-next-line no-new-func -- the artifact is a browser script
  new Function('window', 'require', source)(globalThis.window, require_)
  assert.ok(spec !== undefined, 'the artifact registered no module')
  assert.equal(spec.id, 'dsh-enhance-notify', 'the module id is the package name')
  return spec.factory(require_)
}

/**
 * A context that records what the plugin registers and listens to.
 * @param options - The session rows and the dictionary to translate with.
 * @returns The stub context and the recorded calls.
 */
function stubContext(options = {}) {
  const calls = { listeners: new Map(), registered: [], locales: [], effects: 0 }
  const rows = options.rows ?? { 'session-1': { title: '写周报' } }
  const dictionary = options.dictionary ?? {
    notificationTitle: 'DSH 增强',
    notificationBody: '会话「{title}」的回复已完成',
    notificationBodyFallback: '一个会话的回复已完成',
  }
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
      bind() {
        return (key, params) => {
          const template = dictionary[key] ?? key
          if (params === undefined) return template
          return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
        }
      },
      getSnapshot() { return { active: 'zh' } },
    },
    remote: {
      $on(event, listener) {
        const bucket = calls.listeners.get(event) ?? []
        bucket.push(listener)
        calls.listeners.set(event, bucket)
        return () => {
          const at = bucket.indexOf(listener)
          if (at >= 0) bucket.splice(at, 1)
        }
      },
    },
    sessions: {
      list: { getSnapshot: () => ({ byId: rows }) },
    },
    slots: {
      inject(name, register) { return register() },
      register(registration, component) {
        calls.registered.push({ registration, component })
        return () => {}
      },
    },
  }
  return { ctx, calls }
}

/**
 * Deliver one forwarded Host event to the plugin.
 * @param calls - The recorded calls of the stub context.
 * @param sessionId - the session the event is about.
 * @param running - whether the Agent is running.
 * @returns Nothing.
 */
function emitStatus(calls, sessionId, running) {
  for (const listener of calls.listeners.get('api-session/status') ?? []) {
    listener(sessionId, running)
  }
}

/**
 * The browser world the plugin runs in.
 * @param options - The focus state and the storage.
 * @returns The record of what the plugin did in the browser.
 */
function stubBrowser(options = {}) {
  const audio = stubAudioContext()
  const notification = stubNotification(options.permission ?? 'granted')
  const storage = options.storage ?? stubStorage()
  const record = { audio: audio.record, notification: notification.record }
  globalThis.AudioContext = audio.FakeAudioContext
  globalThis.Notification = notification.FakeNotification
  globalThis.localStorage = storage
  globalThis.document = {
    createElement: () => ({ id: '', dataset: {}, textContent: '', remove() {} }),
    head: { append() {} },
    body: {},
    hasFocus: () => options.focused !== false,
  }
  return record
}

test('the artifact loads no Harness Client package', async () => {
  const source = await readFile(new URL('../packages/notify/lib/client.js', import.meta.url), 'utf8')
  const harnessImports = source.match(/@deepseek-ai\/dsh-client-[a-z-]+/g) ?? []
  assert.deepEqual(harnessImports, [], 'the plugin owns its own controls')
})

test('the artifact asks the shell for react and react-dom only', async () => {
  const source = await readFile(new URL('../packages/notify/lib/client.js', import.meta.url), 'utf8')
  const modules = [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(match => match[1])
  assert.deepEqual([...new Set(modules)].sort(), ['react', 'react-dom'])
})

test('the component registers its row’s configuration page', async () => {
  stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  assert.equal(calls.registered.length, 1, 'one contribution')
  const { registration } = calls.registered[0]
  assert.equal(registration.name, 'plugins.row.config')
  assert.equal(registration.key, 'dsh-enhance#dsh-enhance-notify', 'the key names the bundle and the row')
  assert.equal(registration.locale, 'dsh.enhance.notify')
  assert.deepEqual(calls.locales.map(entry => entry.namespace), ['dsh.enhance.notify'])
})

test('the composer dock is left alone', async () => {
  stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const docks = calls.registered.filter(entry => entry.registration.name === 'conversation.composer.dock')
  assert.deepEqual(docks, [], 'the reply alert is not a composer control')
})

test('the configuration page draws the two switches', async () => {
  stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { registration, component } = calls.registered[0]
  const face = registration.inject()
  const tree = react.render(component, { ...face, t: key => key, view: 'page' })

  const switches = findAll(tree, 'button').filter(node => node.props.role === 'switch')
  assert.equal(switches.length, 2, 'the chime and the system notification each own a switch')
  assert.deepEqual(switches.map(node => node.props['aria-checked']), [true, true], 'both start on')
})

test('the configuration page says nothing when the row wants a one-liner', async () => {
  stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { registration, component } = calls.registered[0]
  const face = registration.inject()
  const tree = react.render(component, { ...face, t: key => key, view: 'summary' })

  assert.equal(tree, null, 'the row carries a description of its own')
})

test('the page offers the four tones in its picker', async () => {
  stubBrowser()
  // The second state of the page is the picker's open flag.
  const react = stubReact({ NotifySettingsPage: [undefined, true] })
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { registration, component } = calls.registered[0]
  const face = registration.inject()
  const tree = react.render(component, { ...face, t: key => key, view: 'page' })

  const options = findAll(tree, 'button').filter(node => node.props.role === 'option')
  assert.equal(options.length, 4, 'one row per tone')
  assert.equal(options.filter(node => node.props['aria-selected'] === true).length, 1, 'one row is chosen')
})

test('picking a tone is remembered in this browser', async () => {
  const storage = stubStorage()
  stubBrowser({ storage })
  const react = stubReact({ NotifySettingsPage: [undefined, true] })
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const { registration, component } = calls.registered[0]
  const face = registration.inject()
  const tree = react.render(component, { ...face, t: key => key, view: 'page' })

  const options = findAll(tree, 'button').filter(node => node.props.role === 'option')
  options[1].props.onClick()

  const stored = JSON.parse(storage.values.get('dsh.enhance.notify'))
  assert.equal(stored.tone, 'bell', 'the chosen tone is the one that is kept')
})

test('the chosen tone is the one that plays', async () => {
  const browser = stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  calls.registered[0].registration.inject().settings.set({ tone: 'wave' })

  emitStatus(calls, 'session-1', true)
  emitStatus(calls, 'session-1', false)

  assert.deepEqual(
    browser.audio.notes.map(note => note.frequency),
    [587.33, 880, 1318.5],
    'the wave tone is three rising notes',
  )
})

test('the component watches the Session status events', async () => {
  stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  assert.ok(calls.listeners.has('api-session/status'), 'the running edge is the signal')
})

test('a finished turn plays the chime', async () => {
  const browser = stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  emitStatus(calls, 'session-1', true)
  assert.equal(browser.audio.notes.length, 0, 'nothing plays while the Agent is running')
  emitStatus(calls, 'session-1', false)

  assert.equal(browser.audio.notes.length, 2, 'the chime is two notes')
  assert.ok(browser.audio.notes.every(note => note.started), 'both notes are scheduled')
})

test('a status event without a running edge plays nothing', async () => {
  const browser = stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  emitStatus(calls, 'session-1', false)
  assert.equal(browser.audio.notes.length, 0, 'an idle Agent is not a finished reply')
})

test('a subagent turn is not a reply to the user', async () => {
  const browser = stubBrowser()
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext({
    rows: { 'session-2': { title: '子任务', origin: 'subagent' } },
  })
  plugin.apply(ctx)

  emitStatus(calls, 'session-2', true)
  emitStatus(calls, 'session-2', false)
  assert.equal(browser.audio.notes.length, 0, 'a subagent stays quiet')
})

test('the system notification waits for a backgrounded window', async () => {
  const focused = stubBrowser({ focused: true })
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  emitStatus(calls, 'session-1', true)
  emitStatus(calls, 'session-1', false)
  assert.equal(focused.notification.shown.length, 0, 'a watched reply needs no toast')

  const background = stubBrowser({ focused: false })
  const { ctx: secondCtx, calls: secondCalls } = stubContext()
  const second = await loadPlugin(react)
  second.apply(secondCtx)
  emitStatus(secondCalls, 'session-1', true)
  emitStatus(secondCalls, 'session-1', false)

  assert.equal(background.notification.shown.length, 1, 'the toast names the finished session')
  assert.equal(background.notification.shown[0].title, 'DSH 增强')
  assert.match(background.notification.shown[0].options.body, /写周报/)
  assert.equal(background.notification.shown[0].options.silent, true, 'the chime already made the noise')
})

test('the switches silence the sound and the toast', async () => {
  const storage = stubStorage()
  const browser = stubBrowser({ focused: false, storage })
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  const face = calls.registered[0].registration.inject()
  face.settings.set({ sound: false, system: false })

  emitStatus(calls, 'session-1', true)
  emitStatus(calls, 'session-1', false)

  assert.equal(browser.audio.notes.length, 0, 'the chime is off')
  assert.equal(browser.notification.shown.length, 0, 'the toast is off')
})

test('the switches are remembered in this browser', async () => {
  const storage = stubStorage()
  stubBrowser({ storage })
  const react = stubReact()
  const plugin = await loadPlugin(react)
  const { ctx, calls } = stubContext()
  plugin.apply(ctx)

  calls.registered[0].registration.inject().settings.set({ sound: false })

  const stored = JSON.parse(storage.values.get('dsh.enhance.notify'))
  assert.equal(stored.sound, false)
  assert.equal(stored.system, true, 'the other switch keeps its value')
})
