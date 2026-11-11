/**
 * schedule-format.js
 */

import { startInZone } from './time-zones.js'

/** Weekday codes of the weekly rule, Monday first. */
const WEEKDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

/**
 * Build exactly one DTSTART and one RRULE for the supported form choices.
 * @param draft - The guided timing values or the advanced text.
 * @param intervalFromNow - Whether a minute or hour interval anchors to the
 * current minute in its zone; false preserves the draft anchor.
 * @returns The RFC 5545 content lines.
 */
export function rruleFromDraft(draft, intervalFromNow = false) {
  if (draft.frequency === 'advanced') return draft.rrule
  const anchor = intervalFromNow && (draft.frequency === 'minutely' || draft.frequency === 'hourly')
    ? startInZone(draft.timeZone)
    : draft.start
  const time = draft.frequency === 'daily' ? `${draft.dailyTime}:00` : anchor.slice(11)
  const start = `${anchor.slice(0, 10)}T${time}`.replace(/[-:]/g, '')
  let rule
  switch (draft.frequency) {
    case 'once':
      rule = 'FREQ=DAILY;COUNT=1'
      break
    case 'minutely':
    case 'hourly':
      rule = `FREQ=${draft.frequency === 'minutely' ? 'MINUTELY' : 'HOURLY'};INTERVAL=${draft.interval}`
      break
    case 'daily':
      rule = `FREQ=DAILY;INTERVAL=${draft.interval};BYHOUR=${Number(draft.dailyTime.slice(0, 2))}`
        + `;BYMINUTE=${Number(draft.dailyTime.slice(3, 5))}`
      break
    case 'weekly':
      rule = `FREQ=WEEKLY;INTERVAL=${draft.interval};BYDAY=${draft.weekdays.map(day => WEEKDAY[day - 1]).join(',')}`
      break
    case 'monthly':
      rule = `FREQ=MONTHLY;INTERVAL=${draft.interval};BYMONTHDAY=${draft.monthDay},-1;BYSETPOS=1`
      break
    default:
      rule = 'FREQ=DAILY;COUNT=1'
  }
  return `DTSTART;TZID=${draft.timeZone}:${start}\nRRULE:${rule}`
}

/**
 * Resolve the custom text into its distinct management type.
 * @param draft - The current rule editor values.
 * @param intervalFromNow - Whether a guided interval timing starts from the
 * current minute.
 * @returns The typed timing for the shared Schedule management API.
 */
export function timingFromDraft(draft, intervalFromNow = false) {
  if (draft.frequency === 'advanced' && !draft.rrule.trimStart().startsWith('DTSTART')) {
    return { kind: 'cron', cron: { expression: draft.rrule.trim(), time_zone: draft.timeZone } }
  }
  return { kind: 'rrule', rrule: rruleFromDraft(draft, intervalFromNow) }
}

