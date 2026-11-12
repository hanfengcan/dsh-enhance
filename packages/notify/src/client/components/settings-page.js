/**
 * components/settings-page.js
 *
 * The reply-alert configuration page, as the Plugins page renders it.
 *
 * The page rides the `plugins.row.config` seat: the entry this bundle's patch
 * declares is a **row**, and the row's own page is where its configuration
 * lives. The key is `<bundle package name>#<row id>`, which is how the page
 * knows the configuration in front of it belongs to this row.
 *
 * The switches are a per-browser preference (a chime is a habit of one
 * workstation, not a fact of the deployment), so they live in `localStorage`
 * rather than in the profile's configuration — this component therefore reads
 * and writes them itself and needs nothing from the Host but the seat.
 *
 * The controls are drawn here, not imported: this component owns its own
 * markup, and the Host theme's tokens are its only styling dependency.
 */

import { createElement as h, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { TONE_IDS } from '../tones.js'
import { useDismissOnEscape, useDismissOnOutsidePointer } from '../hooks.js'

/** The Host's chevron symbol, the one that says a control opens something. */
const CHEVRON = 'dsw-icon-chevron-down-outline-regular'

/** The Host's check symbol, the one that says a row is the chosen one. */
const CHECK = 'dsw-icon-check-outline-regular'

/**
 * The reply-alert configuration page.
 * @param props - The preference store, the chime, and the copy.
 * @returns The page element, or null when the page wants only a one-liner.
 */
export function NotifySettingsPage({ settings, chime, t, view }) {
  // The one-liner the row page falls back to when the row carries no
  // description of its own; this row always has one, so there is nothing to
  // say here.
  if (view === 'summary') return null

  const [state, setState] = useState(() => settings.get())
  const [toneOpen, setToneOpen] = useState(false)

  useEffect(() => settings.subscribe(setState), [settings])

  /**
   * Turn one switch on or off.
   * @param key - the switch's key.
   * @param value - the new value.
   * @returns Nothing.
   */
  const toggle = (key, value) => {
    settings.set({ [key]: value })
  }

  /**
   * Play the chosen tone once, so the user can hear what they picked.
   * @returns Nothing.
   */
  const preview = () => {
    chime.unlock()
    chime.play(state.tone)
  }

  return h('div', { className: 'dsh-enhance-notify-page' },
    h(Field, {
      label: t('soundLabel'),
      hint: t('soundHint'),
      control: h(Switch, {
        checked: state.sound,
        label: t('soundLabel'),
        onChange: value => { toggle('sound', value) },
      }),
    }),
    h(Field, {
      label: t('toneLabel'),
      hint: t('toneHint'),
      control: h(ToneSelect, {
        value: state.tone,
        t,
        open: toneOpen,
        onOpenChange: setToneOpen,
        onPick: (id) => {
          settings.set({ tone: id })
          setToneOpen(false)
          chime.unlock()
          chime.play(id)
        },
      }),
    }),
    h(Field, {
      label: t('systemLabel'),
      hint: t('systemHint'),
      control: h(Switch, {
        checked: state.system,
        label: t('systemLabel'),
        onChange: value => { toggle('system', value) },
      }),
    }),
    h(Field, {
      label: t('previewLabel'),
      hint: t('previewHint'),
      control: h('button', {
        type: 'button',
        className: 'dsh-enhance-notify-button',
        onClick: preview,
      }, t('previewAction')),
    }))
}

/**
 * One field: a label with its control, and the explanation under it.
 * @param props - The label, the hint, and the control.
 * @returns The field element.
 */
function Field({ label, hint, control }) {
  return h('div', { className: 'dsh-enhance-notify-field' },
    h('div', { className: 'dsh-enhance-notify-head' },
      h('span', { className: 'dsh-enhance-notify-label' }, label),
      control),
    h('p', { className: 'dsh-enhance-notify-hint' }, hint))
}

/**
 * The on/off switch, drawn with the Host's switch geometry.
 * @param props - The checked state, the accessible name, and the change action.
 * @returns The switch element.
 */
function Switch({ checked, label, onChange }) {
  return h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': checked,
    'aria-label': label,
    className: 'dsh-enhance-notify-switch',
    onClick: () => { onChange(!checked) },
  }, h('span', { className: 'dsh-enhance-notify-thumb' }))
}

/**
 * The tone picker: a button that opens the list of tones.
 * @param props - The chosen tone, the copy, the open state, and the actions.
 * @returns The picker element.
 */
function ToneSelect({ value, t, open, onOpenChange, onPick }) {
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const positionRef = useRef({ left: 0, top: 0 })

  useDismissOnOutsidePointer(anchorRef, () => { onOpenChange(false) }, open, menuRef)
  useDismissOnEscape(() => { onOpenChange(false) }, open)

  /**
   * Where the menu goes: under its button, right-aligned with it, the way the
   * Host's own pickers sit against the value they replace.
   * @param event - The click that opened the menu.
   * @returns Nothing.
   */
  const openMenu = (event) => {
    const anchor = event.currentTarget
    const rect = anchor.getBoundingClientRect()
    const width = 168
    positionRef.current = {
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: Math.min(rect.bottom + 4, Math.max(8, window.innerHeight - 200)),
    }
    onOpenChange(true)
  }

  const position = positionRef.current

  return h('span', { className: 'dsh-enhance-notify-selectWrap' },
    h('button', {
      type: 'button',
      ref: anchorRef,
      className: 'dsh-enhance-notify-select',
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      'aria-label': t('toneLabel'),
      onClick: openMenu,
    },
    h('span', { className: 'dsh-enhance-notify-selectText' }, t(`tone.${value}`)),
    h('span', { className: 'dsh-enhance-notify-selectIcon' }, icon(CHEVRON))),
    open ? createPortal(
      h('div', {
        ref: menuRef,
        className: 'dsh-enhance-notify-menu',
        role: 'listbox',
        style: { left: `${String(position.left)}px`, top: `${String(position.top)}px` },
      },
      TONE_IDS.map(id => h('button', {
        type: 'button',
        role: 'option',
        'aria-selected': id === value,
        className: 'dsh-enhance-notify-menuItem',
        key: id,
        onClick: () => { onPick(id) },
      },
      h('span', { className: 'dsh-enhance-notify-menuCheck' }, id === value ? icon(CHECK) : null),
      h('span', {}, t(`tone.${id}`))))),
      document.body,
    ) : null)
}

/**
 * One Host sprite symbol.
 * @param id - The symbol's id.
 * @returns The symbol element.
 */
function icon(id) {
  return h('svg', { 'aria-hidden': 'true' }, h('use', { href: `#${id}` }))
}
