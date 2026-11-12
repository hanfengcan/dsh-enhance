/**
 * settings.js
 *
 * The switches this component owns: the chime, the system notification, and
 * which tone the chime plays. They are a per-browser preference, not a Host
 * configuration, so they live in `localStorage` — the same place the shipped
 * voice-input package keeps its remembered microphone.
 */

import { DEFAULT_TONE, isTone } from './tones.js'

/** Storage key of this component's preferences. */
export const STORAGE_KEY = 'dsh.enhance.notify'

/** The switches' default state: both on, playing the default tone. */
export const DEFAULTS = Object.freeze({ sound: true, system: true, tone: DEFAULT_TONE })

/**
 * The browser's local storage, or undefined where it is unavailable.
 * @returns The storage object, or undefined.
 */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? undefined
  } catch {
    // A browser in private mode can throw on access; the component then runs
    // with in-memory settings only.
    return undefined
  }
}

/**
 * Read the stored preferences.
 * @param storage - the storage to read, if any.
 * @returns the stored switches, merged over the defaults.
 */
function readStored(storage) {
  if (storage === undefined) return { ...DEFAULTS }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return { ...DEFAULTS }
    return {
      sound: parsed.sound !== false,
      system: parsed.system !== false,
      tone: isTone(parsed.tone) ? parsed.tone : DEFAULTS.tone,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * The component's preference store: current switches, a write path, and the
 * listeners that re-render the entry when a switch changes.
 * @param storage - the storage to persist in, if any.
 * @returns the store.
 */
export function createSettingsStore(storage = defaultStorage()) {
  let state = readStored(storage)
  const listeners = new Set()

  /**
   * Persist the current switches.
   * @returns Nothing.
   */
  const persist = () => {
    if (storage === undefined) return
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // A full or blocked storage must not break the switch that was pressed.
    }
  }

  /**
   * Tell every listener that the switches changed.
   * @returns Nothing.
   */
  const publish = () => {
    for (const listener of [...listeners]) listener(state)
  }

  return {
    /**
     * The current switches.
     * @returns the current state.
     */
    get() {
      return state
    },
    /**
     * Change one switch and persist the result.
     * @param patch - the switches to change.
     * @returns the new state.
     */
    set(patch) {
      state = { ...state, ...patch }
      persist()
      publish()
      return state
    },
    /**
     * Listen for switch changes.
     * @param listener - called with the new state.
     * @returns a disposer.
     */
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
