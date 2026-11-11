/**
 * components/date-picker.js
 */

import { createElement as h, useEffect, useRef, useState } from 'react'
import { icon } from '../icons.js'
import { PickerPopover } from '../components/primitives.js'

/** ISO calendar date, the only text the date row stores. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Weekday column headings, Monday first as the weekly choice orders them. */
const WEEKDAY_KEYS = ['weekday1', 'weekday2', 'weekday3', 'weekday4', 'weekday5', 'weekday6', 'weekday7']

/** Arrow key to the number of days it moves the focused cell. */
const STEP_BY_KEY = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

/**
 * Zero-padded two-digit field.
 * @param value - The number to pad.
 * @returns Its two-digit text.
 */
function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * The month and day one stored date opens on.
 * @param date - The staged ISO date text.
 * @returns Its own year, month, and day, or today when it is not an ISO date.
 */
function viewOf(date) {
  const match = ISO_DATE.exec(date)
  if (match === null) {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() }
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}

/**
 * Last day of one month.
 * @param view - Year and zero-based month.
 * @returns That month's length in days.
 */
function daysIn(view) {
  return new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
}

/**
 * The same day in another month, clamped to that month's length.
 * @param view - The current month and day.
 * @param step - Months to move, negative for earlier.
 * @returns The moved view.
 */
function shiftMonth(view, step) {
  const months = view.year * 12 + view.month + step
  const moved = { year: Math.floor(months / 12), month: months % 12 }
  return { ...moved, day: Math.min(view.day, daysIn(moved)) }
}

/**
 * ISO text of one day in a shown month.
 * @param view - The shown year and month.
 * @param day - The day of that month.
 * @returns `YYYY-MM-DD`.
 */
function isoOf(view, day) {
  return `${view.year}-${pad(view.month + 1)}-${pad(day)}`
}

/**
 * The month calendar of the Date row.
 * @param props - The open state, the trigger, the staged date, the pick and
 * close callbacks, and the row copy.
 * @returns The anchored panel while open, and nothing while closed.
 */
export function DatePicker({ open, anchorRef, value, onPick, onClose, t, locale }) {
  const refs = useRef(new Map())
  const valueRef = useRef(value)
  valueRef.current = value
  const [view, setView] = useState(() => viewOf(value))
  const today = new Date()
  const todayIso = isoOf({ year: today.getFullYear(), month: today.getMonth() }, today.getDate())

  // Opening returns to the stored day, so the grid starts where the row does.
  useEffect(() => {
    if (!open) return
    setView(viewOf(valueRef.current))
  }, [open])

  // The focused day owns the keyboard, and a pick leaves it on that day.
  useEffect(() => {
    if (!open) return
    refs.current.get(String(view.day))?.focus()
  }, [open, view])

  /**
   * Stage one day of the shown month and leave the keyboard on it.
   * @param day - The day of the shown month.
   * @returns Nothing.
   */
  const pick = (day) => {
    setView(current => ({ ...current, day }))
    onPick(isoOf(view, day))
  }

  /**
   * Move the focused cell inside the month, or stage the day it is on.
   * @param event - The keydown from that cell.
   * @param day - The day of the shown month the cell holds.
   * @returns Nothing.
   */
  const onCellKeyDown = (event, day) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(day)
      return
    }
    const step = STEP_BY_KEY[event.key] ?? 0
    if (step === 0) return
    event.preventDefault()
    const last = daysIn(view)
    setView(current => ({ ...current, day: Math.min(Math.max(day + step, 1), last) }))
  }

  const first = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay()
  const offset = (first + 6) % 7
  const total = daysIn(view)
  const cellCount = Math.ceil((offset + total) / 7) * 7
  const weeks = Array.from({ length: cellCount / 7 }, (_value, week) => week)
  const monthTitle = new Intl.DateTimeFormat(locale ?? t('timeLocale'), {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(Date.UTC(view.year, view.month, 1))

  return h(PickerPopover, {
    open,
    anchorRef,
    label: t('date'),
    className: 'dsh-enhance-calendar',
    onClose,
  },
  h('div', { className: 'dsh-enhance-calendarHead' },
    h('button', {
      type: 'button',
      className: 'dsh-enhance-calendarNav',
      'aria-label': t('prevMonth'),
      onClick: () => { setView(current => shiftMonth(current, -1)) },
    }, icon('dsw-icon-chevron-left-outline-regular', 14)),
    h('span', { className: 'dsh-enhance-calendarTitle', 'aria-live': 'polite' }, monthTitle),
    h('button', {
      type: 'button',
      className: 'dsh-enhance-calendarNav',
      'aria-label': t('nextMonth'),
      onClick: () => { setView(current => shiftMonth(current, 1)) },
    }, icon('dsw-icon-chevron-right-outline-regular', 14))),
  h('div', { className: 'dsh-enhance-calendarGrid', role: 'grid', 'aria-label': monthTitle },
    h('div', { role: 'row', className: 'dsh-enhance-calendarWeek' },
      WEEKDAY_KEYS.map(key => h('div', {
        key, role: 'columnheader', className: 'dsh-enhance-calendarWeekday',
      }, t(key)))),
    weeks.map(week => h('div', { key: week, role: 'row', className: 'dsh-enhance-calendarWeek' },
      Array.from({ length: 7 }, (_value, column) => week * 7 + column - offset + 1).map(day => (
        day < 1 || day > total
          ? h('div', { key: day, role: 'gridcell', 'aria-hidden': 'true', className: 'dsh-enhance-calendarBlank' })
          : h('div', {
            key: day,
            ref: (element) => {
              if (element === null) refs.current.delete(String(day))
              else refs.current.set(String(day), element)
            },
            role: 'gridcell',
            'aria-selected': isoOf(view, day) === value,
            'aria-current': isoOf(view, day) === todayIso ? 'date' : undefined,
            tabIndex: day === view.day ? 0 : -1,
            className: [
              'dsh-enhance-calendarCell',
              isoOf(view, day) === value ? 'dsh-enhance-calendarSelected' : '',
            ].filter(part => part !== '').join(' '),
            onClick: () => { pick(day) },
            onKeyDown: (event) => { onCellKeyDown(event, day) },
          }, day))))))
  )
}

