/**
 * time-zones.js
 */



/**
 * The current minute in the selected zone, as the anchor of a newly saved
 * minute or hour interval.
 * @param timeZone - The zone the stored DTSTART uses.
 * @returns The zone-local date and whole-minute time.
 */
export function startInZone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(Date.now())
  const field = (type) => parts.find(part => part.type === type)?.value ?? ''
  return `${field('year')}-${field('month')}-${field('day')}T${field('hour')}:${field('minute')}:00`
}

/**
 * Initial form values for a new task.
 * @returns Guided timing with a one-hour-ahead one-shot default.
 */
export function defaultTiming() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  const start = `${local.toISOString().slice(0, 16)}:00`
  const day = Number(start.slice(8, 10))
  const weekday = (new Date(`${start.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7 + 1
  return {
    frequency: 'once',
    interval: '1',
    start,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rrule: '',
    weekdays: [weekday],
    monthDay: day,
    dailyTime: start.slice(11, 16),
  }
}

/** Universal fallback when a runtime cannot enumerate its ICU time-zone data. */
const FALLBACK_ZONES = ['UTC']

/**
 * UTC offset, in minutes, of one IANA zone at the current instant.
 * @param zone - The IANA zone to measure.
 * @param at - The instant to measure it at.
 * @returns The offset in minutes, or undefined for an unusable zone.
 */
function zoneOffset(zone, at) {
  try {
    const value = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, timeZoneName: 'longOffset',
    }).formatToParts(at).find(part => part.type === 'timeZoneName')?.value
    if (value === 'GMT') return 0
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(value ?? '')
    if (match === null) return undefined
    const minutes = Number(match[2]) * 60 + Number(match[3])
    return match[1] === '-' ? -minutes : minutes
  } catch (_error) {
    return undefined
  }
}

/**
 * Stable UTC-offset label for one valid IANA zone.
 * @param zone - The IANA zone to label.
 * @param at - The instant to measure it at.
 * @param prefix - The offset's prefix.
 * @returns The offset label, or undefined for an unusable zone.
 */
function zoneOffsetLabel(zone, at, prefix) {
  const minutes = zoneOffset(zone, at)
  if (minutes === undefined) return undefined
  const absolute = Math.abs(minutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const remainder = String(absolute % 60).padStart(2, '0')
  return `${prefix}${minutes < 0 ? '-' : '+'}${hours}:${remainder}`
}

/**
 * Localize one IANA zone through the runtime's ICU data, prefixed by its
 * current UTC offset.
 * @param zone - The IANA zone to label.
 * @param locale - The ICU locale naming the zone.
 * @param t - The row copy, which names the offset prefix.
 * @param at - The instant to resolve the offset and the name at.
 * @returns The UTC offset and the localized zone name.
 */
function zoneLabel(zone, locale, t, at = Date.now()) {
  const offset = zoneOffsetLabel(zone, at, t('utcPrefix'))
  try {
    const name = new Intl.DateTimeFormat(locale, {
      timeZone: zone, timeZoneName: 'longGeneric',
    }).formatToParts(at).find(part => part.type === 'timeZoneName')?.value
    if (offset === undefined) return name ?? zone
    return name === undefined || /^GMT(?:[+-]|$)/.test(name) ? offset : `${offset} · ${name}`
  } catch (_error) {
    return offset === undefined ? zone : `${offset} · ${zone}`
  }
}

/**
 * Name one zone and mark it when it is the host's own zone.
 * @param zone - The IANA zone to name.
 * @param system - The host's current IANA zone.
 * @param locale - The ICU locale naming the zone.
 * @param t - The row copy.
 * @param at - The instant to resolve the offset and the name at.
 * @returns The UTC offset, the localized zone name, and the system suffix.
 */
export function zoneName(zone, system, locale, t, at = Date.now()) {
  const name = zoneLabel(zone, locale, t, at)
  return zone === system ? `${name}${t('zoneSystem')}` : name
}

/**
 * The IANA zones this runtime enumerates, or undefined when it cannot.
 * @returns The enumerated zones, or undefined when enumeration fails.
 */
function timeZoneInventory() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch (_error) {
    return undefined
  }
}

/**
 * The zones the time-zone menu offers, in menu order: the host's current
 * zone, then the runtime's inventory ordered by current UTC offset and
 * canonical id, including a stored alias the inventory omits.
 * @param stored - The zone the shown rule stores.
 * @param system - The host's current IANA zone.
 * @param at - The instant to order the zones at.
 * @returns The IANA zones in menu order, de-duplicated.
 */
export function zoneChoices(stored, system, at = Date.now()) {
  const inventory = timeZoneInventory()
  const zones = inventory === undefined ? FALLBACK_ZONES : [...FALLBACK_ZONES, ...inventory]
  const choices = [...new Set([...zones, stored])].filter(zone => zone !== system)
  const ordered = choices
    .map(zone => ({ zone, offset: zoneOffset(zone, at) ?? Number.POSITIVE_INFINITY }))
    .sort((left, right) => {
      if (left.offset !== right.offset) return left.offset - right.offset
      return left.zone < right.zone ? -1 : 1
    })
    .map(entry => entry.zone)
  return [system, ...ordered]
}

/** Browser-local recently selected IANA time zones. */
const RECENT_ZONES_KEY = 'dsh.schedule.recent-time-zones.v1'

/** How many recent zones the menu keeps. */
const RECENT_ZONES_LIMIT = 5

/**
 * Load up to five recent zones, or the system-zone/UTC first-run seed.
 * @param system - The host's current IANA zone.
 * @returns The recent IANA zones in most-recent-first order.
 */
export function loadRecentTimeZones(system) {
  const defaults = [...new Set([system, 'UTC'])]
  if (typeof localStorage === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(RECENT_ZONES_KEY)
    if (raw === null) return defaults
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaults
    const zones = [...new Set(parsed.filter(value => typeof value === 'string' && value !== ''))]
    return zones.length === 0 ? defaults : zones.slice(0, RECENT_ZONES_LIMIT)
  } catch (_error) {
    return defaults
  }
}

/**
 * Promote one exact IANA id and persist the bounded list when storage is
 * available.
 * @param recent - The current most-recent-first IANA zones.
 * @param zone - The exact IANA zone to promote.
 * @returns The updated bounded most-recent-first list.
 */
export function rememberTimeZone(recent, zone) {
  const next = [zone, ...recent.filter(value => value !== zone)].slice(0, RECENT_ZONES_LIMIT)
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RECENT_ZONES_KEY, JSON.stringify(next))
    } catch (_error) {
      // A private or full browser store must not block editing the rule.
    }
  }
  return next
}

