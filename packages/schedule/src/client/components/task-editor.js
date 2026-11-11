/**
 * components/task-editor.js
 */

import { createElement as h, useRef, useState } from 'react'
import { RuleSelectRow, RuleStepper, RuleWeekdayRow, RuleZoneRow } from '../components/rule-rows.js'
import { nextId } from '../id-counter.js'
import { calendarIcon, icon } from '../icons.js'
import { DatePicker } from '../components/date-picker.js'
import { ClockPicker } from '../components/clock-picker.js'
import { rruleFromDraft } from '../schedule-format.js'

/**
 * The rule editor of the shipped task manager: the repeat row, the rows the
 * chosen frequency adds, and the time zone row.
 *
 * The destination row is not part of it: this plugin always runs the task
 * in the conversation it sits in.
 *
 * @param props - The draft, the change action, the disabled state, and the
 * row copy.
 * @returns The rule editor element.
 */
export function TaskEditorFields({ draft, onChange, disabled, t, locale }) {
  const [dateOpen, setDateOpen] = useState(false)
  const [clockOpen, setClockOpen] = useState(false)
  const dateAnchor = useRef(null)
  const clockAnchor = useRef(null)
  const idRef = useRef(null)
  if (idRef.current === null) idRef.current = nextId('dsh-enhance')
  const id = idRef.current
  const rowId = (name) => `${id}-${name}`
  const change = (patch) => { onChange({ ...draft, ...patch }) }
  const clock = draft.frequency === 'daily' ? `${draft.dailyTime}:00` : draft.start.slice(11)
  const clockText = draft.frequency === 'daily' ? draft.dailyTime : draft.start.slice(11)
  const weekdays = draft.frequency === 'weekly'
    && draft.weekdays.length === 5
    && [1, 2, 3, 4, 5].every(day => draft.weekdays.includes(day))
  const frequencyItems = [
    { id: 'weekly', label: t('frequencyWeekly') },
    { id: 'weekdays', label: t('frequencyWeekdays') },
    { id: 'daily', label: t('frequencyDaily') },
    { id: 'hourly', label: t('frequencyHourly') },
    { id: 'minutely', label: t('frequencyMinutely') },
    { id: 'monthly', label: t('frequencyMonthly') },
    { id: 'once', label: t('frequencyOnce') },
    { id: 'advanced', label: t('frequencyAdvanced') },
  ]
  const frequencyValue = weekdays ? 'weekdays' : draft.frequency
  return h('section', {
    className: 'dsh-enhance-editorField',
    'aria-label': t('ruleTitle'),
    // The pickers portal into the document body, but React bubbles their
    // events through this tree, so the Escape guard still sees them.
    onKeyDownCapture: (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (!dateOpen && !clockOpen) return
      event.preventDefault()
      event.stopPropagation()
      if (dateOpen) {
        setDateOpen(false)
        dateAnchor.current?.focus()
      } else {
        setClockOpen(false)
        clockAnchor.current?.focus()
      }
    },
  },
  h('h3', {}, t('ruleTitle')),
  h('div', { className: 'dsh-enhance-ruleRows' },
    h(RuleSelectRow, {
      label: t('repeat'),
      value: frequencyValue,
      disabled,
      items: frequencyItems,
      current: frequencyItems.find(item => item.id === frequencyValue).label,
      onChange: (value) => {
        const frequency = value === 'weekdays' ? 'weekly' : value
        change({
          frequency,
          ...(value === 'weekdays' ? { weekdays: [1, 2, 3, 4, 5] } : {}),
          ...(frequency === 'advanced' ? { rrule: rruleFromDraft(draft, true) } : {}),
        })
      },
    }),
    draft.frequency !== 'once' && draft.frequency !== 'advanced'
      ? h('div', { className: 'dsh-enhance-ruleRow' },
        h('label', { className: 'dsh-enhance-ruleLabel', htmlFor: rowId('interval') }, t('interval')),
        h(RuleStepper, {
          id: rowId('interval'),
          min: 1,
          max: Number.MAX_SAFE_INTEGER,
          value: Number(draft.interval),
          disabled,
          increaseLabel: t('intervalIncrease'),
          decreaseLabel: t('intervalDecrease'),
          onChange: (value) => { change({ interval: String(value) }) },
        }))
      : null,
    draft.frequency === 'weekly'
      ? h(RuleWeekdayRow, {
        weekdays: draft.weekdays,
        disabled,
        t,
        rowId,
        onToggle: (day) => {
          change({
            weekdays: draft.weekdays.includes(day)
              ? draft.weekdays.filter(value => value !== day)
              : [...draft.weekdays, day].sort(),
          })
        },
      })
      : null,
    draft.frequency === 'monthly'
      ? h('div', { className: 'dsh-enhance-ruleRow' },
        h('label', { className: 'dsh-enhance-ruleLabel', htmlFor: rowId('monthDay') }, t('monthDay')),
        h(RuleStepper, {
          id: rowId('monthDay'),
          min: 1,
          max: 31,
          value: draft.monthDay,
          disabled,
          increaseLabel: t('intervalIncrease'),
          decreaseLabel: t('intervalDecrease'),
          onChange: (value) => { change({ monthDay: value }) },
        }))
      : null,
    draft.frequency === 'once'
      ? h('div', { className: 'dsh-enhance-ruleRow' },
        h('label', { className: 'dsh-enhance-ruleLabel', htmlFor: rowId('date') }, t('date')),
        h('button', {
          ref: dateAnchor,
          id: rowId('date'),
          type: 'button',
          disabled,
          className: 'dsh-enhance-ruleInput dsh-enhance-ruleControl dsh-enhance-pickerTrigger',
          'aria-label': t('date'),
          'aria-haspopup': 'dialog',
          'aria-expanded': dateOpen,
          onClick: () => { setDateOpen(true) },
        },
        h('span', {}, draft.start.slice(0, 10).replace(/-/g, '/')),
        calendarIcon('dsh-enhance-pickerIcon')),
        h(DatePicker, {
          open: dateOpen && !disabled,
          anchorRef: dateAnchor,
          value: draft.start.slice(0, 10),
          onPick: (date) => { change({ start: `${date}T${clock}` }); setDateOpen(false) },
          onClose: () => { setDateOpen(false) },
          t,
          locale,
        }))
      : null,
    draft.frequency !== 'advanced' && draft.frequency !== 'minutely' && draft.frequency !== 'hourly'
      ? h('div', { className: 'dsh-enhance-ruleRow' },
        h('label', { className: 'dsh-enhance-ruleLabel', htmlFor: rowId('time') }, t('time')),
        h('button', {
          ref: clockAnchor,
          id: rowId('time'),
          type: 'button',
          disabled,
          className: 'dsh-enhance-ruleInput dsh-enhance-ruleControl dsh-enhance-pickerTrigger',
          'aria-label': t('time'),
          'aria-haspopup': 'dialog',
          'aria-expanded': clockOpen,
          onClick: () => { setClockOpen(true) },
        },
        h('span', {}, clockText),
        icon('dsw-icon-clock-outline-regular', 16, 'dsh-enhance-pickerIcon')),
        h(ClockPicker, {
          open: clockOpen && !disabled,
          anchorRef: clockAnchor,
          value: clock,
          seconds: draft.frequency !== 'daily',
          onPick: (time) => {
            change(draft.frequency === 'daily'
              ? { dailyTime: time.slice(0, 5) }
              : { start: `${draft.start.slice(0, 10)}T${time}` })
          },
          onClose: () => { setClockOpen(false) },
          t,
        }))
      : null,
    draft.frequency !== 'advanced'
      || (draft.rrule.trim() !== '' && !draft.rrule.trimStart().startsWith('DTSTART'))
      ? h(RuleZoneRow, {
        value: draft.timeZone,
        disabled,
        t,
        locale,
        onChange: (timeZone) => { change({ timeZone }) },
      })
      : null))
}

