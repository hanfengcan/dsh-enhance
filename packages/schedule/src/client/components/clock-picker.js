/**
 * components/clock-picker.js
 */

import { createElement as h, useEffect, useRef, useState } from 'react'
import { PickerPopover } from '../components/primitives.js'

/** Padded two-digit clock values from zero through `count - 1`. */
function padded(count) {
  return Array.from({ length: count }, (_value, index) => String(index).padStart(2, '0'))
}

/** The picker's columns in display order, each with the label row copy names it by. */
const CLOCK_COLUMNS = [
  { label: 'hour', options: padded(24) },
  { label: 'minute', options: padded(60) },
  { label: 'second', options: padded(60) },
]

/** Leading hour and minute of a clock, with its optional whole seconds. */
const CLOCK = /^(\d{2}):(\d{2})(?::(\d{2}))?/

/**
 * The `HH:MM:SS` clock a pick composes onto.
 * @param value - The staged clock text.
 * @returns Its whole-second clock, or midnight when it states none.
 */
function clockBase(value) {
  const match = CLOCK.exec(value)
  return match === null ? '00:00:00' : `${match[1]}:${match[2]}:${match[3] ?? '00'}`
}

/**
 * Index of one column's option for one clock.
 * @param clock - The whole-second clock text.
 * @param column - The column index in display order.
 * @returns That column's option index, or the first one it does not list.
 */
function columnIndex(clock, column) {
  const options = CLOCK_COLUMNS[column].options
  const start = column === 0 ? 0 : column * 3
  return Math.max(0, options.indexOf(clock.slice(start, start + 2)))
}

/**
 * The clock panel of the Time row: hours, minutes, and optionally seconds,
 * one scrolling column each.
 * @param props - The open state, the trigger, the staged clock, the pick and
 * close callbacks, the seconds-column switch, and the row copy.
 * @returns The anchored panel while open, and nothing while closed.
 */
export function ClockPicker({ open, anchorRef, value, onPick, onClose, seconds = true, t }) {
  const columns = seconds ? CLOCK_COLUMNS : CLOCK_COLUMNS.slice(0, 2)
  const refs = useRef(new Map())
  const valueRef = useRef(value)
  valueRef.current = value
  const base = clockBase(value)
  const picked = [base.slice(0, 2), base.slice(3, 5), base.slice(6, 8)]
  // Each column keeps one focusable entry: the row its own value occupies.
  const columnIndices = [0, 1, 2].map(column => columnIndex(base, column))
  const [cursor, setCursor] = useState({ column: 0, index: columnIndex(base, 0) })

  // Opening starts on the clock the row shows, with every column scrolled
  // to that value.
  useEffect(() => {
    if (!open) return
    setCursor({ column: 0, index: columnIndex(clockBase(valueRef.current), 0) })
    for (const column of [0, 1, 2]) {
      refs.current.get(`${column}:${columnIndex(clockBase(valueRef.current), column)}`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }, [open])

  // The cursor owns the keyboard: a pick, an arrow, or the open itself moves
  // the highlight and takes focus with it.
  useEffect(() => {
    if (!open) return
    refs.current.get(`${cursor.column}:${cursor.index}`)?.focus()
  }, [open, cursor])

  /**
   * Stage one option and move the cursor onto it.
   * @param column - The column index the option belongs to.
   * @param option - The padded option text.
   * @param index - The option index inside that column.
   * @returns Nothing.
   */
  const pick = (column, option, index) => {
    setCursor({ column, index })
    const next = [...picked]
    next[column] = option
    onPick(next.join(':'))
  }

  /**
   * Move inside one column, move between columns, or stage the option the
   * keyboard is on.
   * @param event - The keydown from that option.
   * @param column - The column index the option belongs to.
   * @param index - The option index inside that column.
   * @param option - The padded option text.
   * @param count - The number of options in the column.
   * @returns Nothing.
   */
  const onOptionKeyDown = (event, column, index, option, count) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(column, option, index)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const next = columns[column + (event.key === 'ArrowRight' ? 1 : -1)]
      if (next === undefined) return
      const target = columns.indexOf(next)
      setCursor({ column: target, index: Math.min(index, next.options.length - 1) })
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setCursor({ column, index: event.key === 'Home' ? 0 : count - 1 })
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    setCursor({ column, index: Math.min(Math.max(index + step, 0), count - 1) })
  }

  return h(PickerPopover, {
    open,
    anchorRef,
    label: t('time'),
    className: 'dsh-enhance-clock',
    onClose,
  },
  columns.map((column, at) => h('div', {
    key: column.label, role: 'listbox', 'aria-label': t(column.label),
    className: 'dsh-enhance-clockColumn',
  },
  column.options.map((option, index) => h('div', {
    key: option,
    ref: (element) => {
      const key = `${at}:${index}`
      if (element === null) refs.current.delete(key)
      else refs.current.set(key, element)
    },
    role: 'option',
    'aria-selected': option === picked[at],
    tabIndex: (cursor.column === at ? cursor.index : columnIndices[at]) === index ? 0 : -1,
    className: [
      'dsh-enhance-clockOption',
      option === picked[at] ? 'dsh-enhance-clockSelected' : '',
    ].filter(part => part !== '').join(' '),
    onClick: () => { pick(at, option, index) },
    onKeyDown: (event) => { onOptionKeyDown(event, at, index, option, column.options.length) },
  }, option)))))
}

