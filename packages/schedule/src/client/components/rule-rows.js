/**
 * components/rule-rows.js
 */

import { createElement as h, useMemo, useRef, useState } from 'react'
import { icon } from '../icons.js'
import { TaskMenu } from '../components/primitives.js'
import { loadRecentTimeZones, rememberTimeZone, zoneChoices, zoneName } from '../time-zones.js'
import { nextId } from '../id-counter.js'

/**
 * A labelled menu row using the current rule editor's trigger, portal, and
 * keyboard behavior.
 * @param props - The label, the selected value, the current text, the
 * rows, the disabled state, the change action, the dismiss action, the
 * pinned header, and the list's extra class.
 * @returns The row element.
 */
export function RuleSelectRow({ label, value, current, items, disabled, onChange, onDismiss, header, listClassName }) {
  const [open, setOpen] = useState(false)
  const close = () => { setOpen(false); if (onDismiss !== undefined) onDismiss() }
  return h(TaskMenu, {
    className: 'dsh-enhance-ruleRowMenu',
    open: open && !disabled,
    onClose: close,
    items,
    selectedId: value,
    align: 'end',
    portal: true,
    header,
    listClassName,
    onSelect: (id) => { close(); onChange(id) },
    anchor: h('button', {
      type: 'button', className: 'dsh-enhance-ruleValue', disabled,
      'aria-haspopup': 'menu', 'aria-expanded': open && !disabled,
      onClick: () => { if (open) close(); else setOpen(true) },
    },
    h('span', { className: 'dsh-enhance-ruleLabel' }, label), ' ',
    h('span', { className: 'dsh-enhance-ruleValueFace dsh-enhance-ruleControl' },
      h('span', { className: 'dsh-enhance-ruleCurrent' }, current),
      icon('dsw-icon-chevron-down-outline-regular', 14))),
  })
}

/**
 * The searchable, localized zone menu with recent choices.
 * @param props - The selected zone, the disabled state, the change action,
 * and the row copy.
 * @returns The row element.
 */
export function RuleZoneRow({ value, disabled, onChange, t, locale }) {
  const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState(() => loadRecentTimeZones(systemZone))
  const idRef = useRef(null)
  if (idRef.current === null) idRef.current = nextId('dsh-enhance-zone')
  const id = idRef.current
  const icu = locale ?? t('timeLocale')
  const catalog = useMemo(() => {
    const byLabel = new Map()
    const at = Date.now()
    for (const zone of zoneChoices(value, systemZone, at)) {
      const label = zoneName(zone, systemZone, icu, t, at)
      const existing = byLabel.get(label)
      if (existing === undefined) byLabel.set(label, { id: zone, label, zones: [zone] })
      else {
        existing.zones.push(zone)
        if (zone === value) existing.id = zone
      }
    }
    return [...byLabel.values()]
  }, [value, systemZone, icu, t])
  const normalized = query.trim().toLocaleLowerCase(icu)
  const matches = catalog
    .filter(item => `${item.zones.join(' ')} ${item.label}`.toLocaleLowerCase(icu).includes(normalized))
    .map(item => ({
      ...item,
      id: item.zones.find(zone => zone.toLocaleLowerCase(icu) === normalized) ?? item.id,
    }))
  const recentItems = normalized === ''
    ? recent.flatMap((zone) => {
      const item = catalog.find(candidate => candidate.zones.includes(zone))
      return item === undefined ? [] : [{ ...item, id: zone }]
    }).filter((item, index, items) => items.findIndex(candidate => candidate.label === item.label) === index)
    : []
  const available = matches.filter(item => !recentItems.some(recentItem => recentItem.label === item.label))
  const items = recentItems.length === 0
    ? available
    : available.length === 0
      ? recentItems
      : [...recentItems, { type: 'separator', id: `${id}-recent` }, ...available]
  return h(RuleSelectRow, {
    label: t('zone'),
    value,
    current: zoneName(value, systemZone, icu, t),
    disabled,
    onDismiss: () => { setQuery('') },
    items: items.length === 0
      ? [{ id: `${id}-empty`, label: t('zoneNoResults'), disabled: true }]
      : items,
    listClassName: 'dsh-enhance-zoneMenu',
    header: h('input', {
      className: 'dsh-enhance-zoneSearch',
      type: 'search',
      value: query,
      'data-menu-field': '',
      placeholder: t('zoneSearch'),
      'aria-label': t('zoneSearch'),
      onChange: (event) => { setQuery(event.target.value) },
    }),
    onChange: (zone) => {
      setQuery('')
      setRecent(current => rememberTimeZone(current, zone))
      onChange(zone)
    },
  })
}

/**
 * The weekly rule's Weekday row: one pill per weekday, toggled in the rule
 * the caller is editing.
 * @param props - The selected weekdays, the disabled state, the row copy,
 * the id builder, and the toggle action.
 * @returns The labelled Weekday row.
 */
export function RuleWeekdayRow({ weekdays, disabled, t, rowId, onToggle }) {
  return h('div', { className: 'dsh-enhance-ruleRow' },
    h('span', { className: 'dsh-enhance-ruleLabel', id: rowId('weekday') }, t('weekday')),
    h('div', {
      className: 'dsh-enhance-ruleWeekdays dsh-enhance-ruleControl',
      role: 'group',
      'aria-labelledby': rowId('weekday'),
    },
    [1, 2, 3, 4, 5, 6, 7].map(weekday => {
      const selected = weekdays.includes(weekday)
      return h('button', {
        key: weekday,
        type: 'button',
        className: [
          'dsh-enhance-weekdayPill',
          selected ? 'dsh-enhance-weekdayPill-active' : '',
        ].filter(part => part !== '').join(' '),
        disabled,
        'aria-pressed': selected,
        'aria-label': t('weekdayOption', { weekday: t(`weekday${weekday}`) }),
        onClick: () => { onToggle(weekday) },
      }, t(`weekday${weekday}`))
    })))
}

/**
 * One whole-number stepper of the rule form, such as the repeat interval or
 * the day of the month.
 * @param props - The id, the bounds, the staged value, the disabled state,
 * the arrow labels, and the change action.
 * @returns The stepper pill.
 */
export function RuleStepper({ id, min, max, value, disabled, increaseLabel, decreaseLabel, onChange }) {
  const clamp = (next) => Math.min(max, Math.max(min, next))
  return h('span', {
    className: 'dsh-enhance-ruleIntervalStepper',
    style: { '--interval-digits': String(value).length },
  },
  h('input', {
    id,
    className: 'dsh-enhance-ruleInput dsh-enhance-ruleControl dsh-enhance-ruleIntervalInput',
    type: 'number',
    min,
    max,
    step: 1,
    disabled,
    value,
    onChange: (event) => {
      const next = Number(event.target.value)
      if (event.target.value === '' || !Number.isSafeInteger(next)) return
      onChange(clamp(next))
    },
  }),
  h('span', { className: 'dsh-enhance-ruleIntervalArrows' },
    h('button', {
      type: 'button',
      className: 'dsh-enhance-ruleIntervalArrow',
      'aria-label': increaseLabel,
      disabled: disabled || value >= max,
      onClick: () => { onChange(clamp(value + 1)) },
    }, icon('dsw-icon-chevron-up-outline-regular', 9)),
    h('button', {
      type: 'button',
      className: 'dsh-enhance-ruleIntervalArrow',
      'aria-label': decreaseLabel,
      disabled: disabled || value <= min,
      onClick: () => { onChange(clamp(value - 1)) },
    }, icon('dsw-icon-chevron-down-outline-regular', 9))))
}

