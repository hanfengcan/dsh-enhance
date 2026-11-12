/**
 * tones.js
 *
 * The reply-done sounds, as notes rather than as audio files.
 *
 * Every tone is a short phrase: a list of notes, each with a frequency, the
 * moment it starts, how long it rings, and how loud it is relative to the
 * others. The player turns those into oscillators, so the plugin ships no
 * media at all — and a new tone is a new list, not a new asset.
 *
 * The four tones answer four different habits:
 *
 * - `chime` — a rising fifth: the plain "I am done" signal;
 * - `bell`  — one struck bell with its overtones: the formal one;
 * - `pulse` — two short pulses: the discreet one, easy to miss in a loud room;
 * - `wave`  — three rising notes: the one that sounds like a wave coming in.
 */

/**
 * One note of a phrase.
 * @typedef {object} ToneNote
 * @property {number} frequency - The pitch in hertz.
 * @property {number} offset - Seconds after the phrase starts.
 * @property {number} duration - Seconds the note rings for.
 * @property {number} [gain] - The note's loudness relative to the phrase.
 * @property {number} [harmonics] - How many partials a struck tone carries.
 */

/**
 * The tones, in the order the settings page lists them.
 * @type {Readonly<Record<string, { readonly id: string, readonly notes: readonly ToneNote[] }>>}
 */
export const TONES = Object.freeze({
  chime: Object.freeze({
    id: 'chime',
    notes: Object.freeze([
      { frequency: 880, offset: 0, duration: 0.18, gain: 0.9 },
      { frequency: 1318.5, offset: 0.14, duration: 0.3, gain: 1 },
    ]),
  }),
  bell: Object.freeze({
    id: 'bell',
    notes: Object.freeze([
      { frequency: 659.25, offset: 0, duration: 0.9, gain: 1, harmonics: 3 },
    ]),
  }),
  pulse: Object.freeze({
    id: 'pulse',
    notes: Object.freeze([
      { frequency: 1046.5, offset: 0, duration: 0.1, gain: 1 },
      { frequency: 1046.5, offset: 0.16, duration: 0.1, gain: 0.8 },
    ]),
  }),
  wave: Object.freeze({
    id: 'wave',
    notes: Object.freeze([
      { frequency: 587.33, offset: 0, duration: 0.2, gain: 0.8 },
      { frequency: 880, offset: 0.12, duration: 0.2, gain: 0.9 },
      { frequency: 1318.5, offset: 0.24, duration: 0.36, gain: 1 },
    ]),
  }),
})

/** The tone ids, in listing order. */
export const TONE_IDS = Object.freeze(Object.keys(TONES))

/** The tone a deployment gets when it has not chosen one. */
export const DEFAULT_TONE = 'chime'

/**
 * The notes of one tone, falling back to the default for an unknown id.
 * @param id - The tone's id.
 * @returns The tone's notes.
 */
export function notesOf(id) {
  const tone = TONES[id]
  if (tone !== undefined) return tone.notes
  return TONES[DEFAULT_TONE].notes
}

/**
 * Whether an id names a tone this plugin knows.
 * @param id - The candidate id.
 * @returns true when the id names a tone.
 */
export function isTone(id) {
  return typeof id === 'string' && Object.hasOwn(TONES, id)
}
