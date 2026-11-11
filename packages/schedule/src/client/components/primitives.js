/**
 * components/primitives.js
 */

import { createElement as h, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { icon } from '../icons.js'
import { isMobileDevice, useAnchoredPosition, useDialogLayer, useDismissOnOutsidePointer } from '../hooks.js'

/**
 * The plugin's own button: the Host's control geometry and its token-backed
 * variants.
 * @param props - The variant, the children, and the native button attributes.
 * @returns The button element.
 */
export function Button({ variant = 'ghost', className, children, ...rest }) {
  return h('button', {
    ...rest,
    type: 'button',
    className: ['dsh-enhance-button', `dsh-enhance-button-${variant}`, className]
      .filter(part => part !== undefined && part !== null && part !== '')
      .join(' '),
  }, children)
}

/**
 * The plugin's own text input: a bordered single-line control wrapping the
 * native input.
 * @param props - The native input attributes.
 * @returns The wrapper element.
 */
export function Input({ className, ...rest }) {
  return h('span', {
    className: ['dsh-enhance-input', className]
      .filter(part => part !== undefined && part !== null && part !== '')
      .join(' '),
  }, h('input', { ...rest, className: 'dsh-enhance-input-element' }))
}

/**
 * The plugin's own modal dialog: a masked layer over a centered card.
 * @param props - The open state, the close action, the title, the close
 * label, the body, the footer, and an extra class on the card.
 * @returns The overlay tree, or nothing while the dialog is closed.
 */
export function Dialog({ open, onClose, title, closeLabel, children, footer, className }) {
  const dialogRef = useRef(null)
  useDialogLayer(dialogRef, open, onClose)
  if (!open) return null
  return createPortal(
    h('div', { className: 'dsh-enhance-modal-root', role: 'presentation' },
      h('div', {
        className: 'dsh-enhance-modal-mask', 'aria-hidden': 'true', onClick: onClose,
      }),
      h('div', {
        ref: dialogRef,
        tabIndex: -1,
        className: ['dsh-enhance-modal-card', className]
          .filter(part => part !== undefined && part !== null && part !== '')
          .join(' '),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title,
      },
      h('div', { className: 'dsh-enhance-modal-content' },
        h('div', { className: 'dsh-enhance-modal-header' },
          h('h2', { className: 'dsh-enhance-modal-title' }, title),
          h('button', {
            type: 'button', className: 'dsh-enhance-modal-close',
            'aria-label': closeLabel, onClick: onClose,
          }, icon('dsw-icon-close-outline-regular', 14))),
        h('div', { className: 'dsh-enhance-modal-body' }, children)),
      footer === undefined || footer === null
        ? null
        : h('div', { className: 'dsh-enhance-modal-footer' }, footer))),
    document.body)
}

/**
 * The anchored dropdown menu of the rule rows.
 *
 * The list supports separators and heading labels beside the selectable
 * rows, and it keeps a pinned header above them, so the time zone row can
 * own a search field the keyboard enters as soon as the list is placed.
 *
 * @param props - The open state, the trigger, the rows, the selected row,
 * the selection and close actions, the alignment, the portal switch, the
 * pinned header, and the extra classes.
 * @returns The anchor wrapper with the conditional list.
 */
export function TaskMenu({ open, anchor, items = [], selectedId, onSelect, onClose, align = 'start', portal = false, header, className, listClassName }) {
  const rootRef = useRef(null)
  const listRef = useRef(null)
  /** Index the arrow walk last focused, the resume point when focus left the rows. */
  const walkIndex = useRef(null)
  /** Whether this open already moved the keyboard into the list. */
  const handedOver = useRef(false)
  const openRef = useRef(open)
  openRef.current = open
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const dismiss = useCallback(() => { closeRef.current() }, [])

  const position = useAnchoredPosition({
    open: open && portal, anchorRef: rootRef, panelRef: listRef, align, gap: 4, margin: 12,
  })
  useDismissOnOutsidePointer(rootRef, open, dismiss, listRef)

  /**
   * Hand the keyboard back to the anchor's first enabled button. Focus left
   * on a removed row otherwise falls to the page body.
   * @returns Nothing.
   */
  const refocusAnchor = () => {
    rootRef.current?.querySelector('button:not(:disabled)')?.focus()
  }

  /**
   * Post-selection focus, for the paths where the rows unmount with the
   * list: a keyboard left on the closing list comes back to the anchor.
   * @returns Nothing.
   */
  const refocusAfterSelection = () => {
    queueMicrotask(() => {
      if (openRef.current) return
      const active = document.activeElement
      if (active === null || active === document.body || listRef.current?.contains(active) === true) {
        refocusAnchor()
      }
    })
  }

  // A portaled list paints hidden until the placement effect measures it,
  // and a hidden control refuses focus, so the handover waits for that
  // frame. Focus is handed over once per open.
  useEffect(() => {
    if (!open) {
      handedOver.current = false
      return undefined
    }
    if (handedOver.current || isMobileDevice()) return undefined
    const list = listRef.current
    if (list === null) return undefined
    if (portal && position === null) return undefined
    const field = list.querySelector('[data-menu-field]')
    if (field === null) return undefined
    handedOver.current = true
    field.focus()
    return undefined
  }, [open, portal, position])

  useEffect(() => {
    if (!open) {
      walkIndex.current = null
      return undefined
    }
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return
      const focused = document.activeElement
      const insideList = listRef.current?.contains(focused) === true
      const anchored = rootRef.current?.contains(focused) === true || insideList
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        dismiss()
        if (anchored) refocusAnchor()
      }
      // Tab settles like Enter and Shift+Tab leaves like Escape, so a
      // menu's keys mean what they mean in the composer.
      if (event.key === 'Tab') {
        const list = listRef.current
        if (list === null) return
        if (!anchored) return
        if (event.shiftKey) {
          event.preventDefault()
          dismiss()
          refocusAnchor()
          return
        }
        if (insideList) {
          if (focused instanceof Element && focused.getAttribute('role') === 'menuitem') {
            event.preventDefault()
            focused.click()
          }
          return
        }
        const row = list.querySelector('button:not(:disabled)')
        if (row === null) return
        event.preventDefault()
        row.focus()
        walkIndex.current = 0
        return
      }
      // Arrows walk the list.
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      // An embedded search field owns its text-navigation keys.
      if (event.target instanceof HTMLInputElement && (event.key === 'Home' || event.key === 'End')) return
      const list = listRef.current
      if (list === null || !anchored) return
      const buttons = Array.from(list.querySelectorAll('button:not(:disabled)'))
      if (buttons.length === 0) return
      const index = buttons.indexOf(focused)
      const from = index >= 0 ? index : walkIndex.current
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : from === null
          ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1)
          : (from + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      event.preventDefault()
      walkIndex.current = next
      buttons[next]?.focus()
    }
    // A pointer press inside a cross-origin iframe never reaches this
    // document; the focus move it causes blurs the window instead.
    const onWindowBlur = () => {
      if (document.activeElement instanceof HTMLIFrameElement) dismiss()
    }
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [open, dismiss])

  /**
   * One menu entry: a selectable row, a hairline, or a heading label.
   * @param entry - The entry to render.
   * @returns The entry element.
   */
  const renderEntry = (entry) => {
    if (entry.type === 'separator') {
      return h('div', { key: entry.id, className: 'dsh-enhance-menu-separator', role: 'separator' })
    }
    if (entry.type === 'label') {
      return h('div', { key: entry.id, className: 'dsh-enhance-menu-label', role: 'presentation' }, entry.text)
    }
    const selected = entry.id === selectedId
    return h('div', { key: entry.id, className: 'dsh-enhance-menu-itemWrap' },
      h('button', {
        type: 'button',
        role: 'menuitem',
        className: ['dsh-enhance-menu-item', selected ? 'dsh-enhance-menu-selected' : '']
          .filter(part => part !== '')
          .join(' '),
        disabled: entry.disabled,
        'data-session-schedule-menu-item': entry.id,
        onClick: () => { onSelect(entry.id) },
      },
      entry.icon !== undefined ? h('span', { className: 'dsh-enhance-menu-itemIcon' }, entry.icon) : null,
      h('span', { className: 'dsh-enhance-menu-itemLabel' }, entry.label),
      selected ? icon('dsw-icon-check-outline-regular', 14, 'dsh-enhance-menu-check') : null))
  }

  // Portal lists render hidden until placed: the position hook measures
  // this pre-render in the same commit, so the first painted frame is
  // already at the final coordinates.
  const list = open && h('div', {
    ref: listRef,
    className: [
      'dsh-enhance-menu-list',
      listClassName,
      'dsh-enhance-menu-scrollable',
      portal ? 'dsh-enhance-menu-portal' : '',
      align === 'end' && !portal ? 'dsh-enhance-menu-alignEnd' : '',
    ].filter(part => part !== undefined && part !== null && part !== '').join(' '),
    style: portal ? (position ?? { visibility: 'hidden', left: 0, top: 0 }) : undefined,
    role: 'menu',
    // React portals bubble synthetic events through the React tree: without
    // this stop, a row click re-fires an owner handler above the anchor.
    onClick: (event) => {
      event.stopPropagation()
      const row = event.target instanceof Element
        ? event.target.closest('button[role="menuitem"]')
        : null
      if (row !== null) refocusAfterSelection()
    },
  },
  header !== undefined ? h('div', { className: 'dsh-enhance-menu-header', role: 'presentation' }, header) : null,
  h('div', { className: 'dsh-enhance-menu-viewport', role: 'presentation' },
    items.map(renderEntry)))

  return h('span', {
    ref: rootRef,
    className: ['dsh-enhance-menu-root', className]
      .filter(part => part !== undefined && part !== null && part !== '')
      .join(' '),
  },
  anchor,
  list === false ? null : (portal ? createPortal(list, document.body) : list))
}

/**
 * Anchored, outside-dismissed popover shell the timing pickers share.
 * @param props - The open state, the trigger, the panel name and layout
 * class, the dismissal callback, and the contents.
 * @returns The panel while open, and nothing while closed.
 */
export function PickerPopover({ open, anchorRef, label, className, onClose, children }) {
  const panelRef = useRef(null)
  useDismissOnOutsidePointer(anchorRef, open, onClose, panelRef)
  // The card's right edge lines up with its trigger's right edge, the way
  // the shipped picker sits against the row's value.
  const position = useAnchoredPosition({
    open, anchorRef, panelRef, align: 'end', gap: 4, margin: 12,
  })
  if (!open) return null
  return createPortal(
    h('div', {
      ref: panelRef,
      className: ['dsh-enhance-pickerPanel', className]
        .filter(part => part !== undefined && part !== null && part !== '')
        .join(' '),
      style: position ?? { visibility: 'hidden', left: 0, top: 0 },
      // The rows that open a picker declare `aria-haspopup="dialog"`, so
      // the panel is the dialog they announce.
      role: 'dialog',
      'aria-label': label,
      // A click inside the panel belongs to the picker, not to the row that
      // opened it: React bubbles portal events through the React tree.
      onClick: (event) => { event.stopPropagation() },
    }, children),
    document.body)
}

