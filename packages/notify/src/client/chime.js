/**
 * chime.js
 *
 * The reply-done sound. It is synthesized with the Web Audio API instead of
 * shipped as a file: no asset to ship, no asset to load, and the same tones in
 * the browser and in the desktop shell.
 *
 * Browsers start an `AudioContext` suspended until the page has been interacted
 * with, so the context is created on the first request and resumed on the
 * first gesture.
 */

import { notesOf } from './tones.js'

/** The peak gain of one phrase; the envelope does the rest. */
const PEAK_GAIN = 0.16

/** The partials of a struck tone: the fundamental, then its overtones. */
const HARMONICS = [1, 2.76, 5.4]

/**
 * Create an audio context, or report that this environment has none.
 * @returns The context, or undefined.
 */
function defaultCreateContext() {
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (Ctor === undefined) return undefined
  try {
    return new Ctor()
  } catch {
    // A machine without an audio device refuses to build the context.
    return undefined
  }
}

/**
 * The chime: any of the phrases the tones table holds.
 * @param options - The context factory, injectable for tests.
 * @returns The chime.
 */
export function createChime(options = {}) {
  const { createContext = defaultCreateContext } = options
  let context
  let failed = false

  /**
   * The audio context, created on first use.
   * @returns The context, or undefined when audio is unavailable.
   */
  const ensure = () => {
    if (failed) return undefined
    if (context === undefined) {
      context = createContext()
      if (context === undefined) {
        failed = true
        return undefined
      }
    }
    return context
  }

  /**
   * Schedule one note.
   * @param audio - the audio context.
   * @param note - the note's frequency, offset, length and loudness.
   * @param startAt - the context time the phrase starts at.
   * @returns Nothing.
   */
  const playNote = (audio, note, startAt) => {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(note.frequency, startAt)
    const peak = PEAK_GAIN * (note.gain ?? 1)
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + note.duration + 0.02)
  }

  /**
   * Schedule one struck tone: the fundamental and its overtones, each with its
   * own decay, the way a bell loses its upper partials first.
   * @param audio - the audio context.
   * @param note - the note's pitch and length.
   * @param startAt - the context time the phrase starts at.
   * @returns Nothing.
   */
  const playStruck = (audio, note, startAt) => {
    const count = note.harmonics ?? 1
    for (let index = 0; index < count; index += 1) {
      const partial = HARMONICS[index] ?? 1
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(note.frequency * partial, startAt)
      const peak = PEAK_GAIN * (note.gain ?? 1) / (index + 1.5)
      // The upper partials die sooner, so the tone darkens as it rings out.
      const length = note.duration / (1 + index * 0.8)
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + length)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + length + 0.02)
    }
  }

  return {
    /**
     * Play one tone.
     * @param tone - The tone's id; an unknown id plays the default tone.
     * @returns true when the phrase was scheduled.
     */
    play(tone) {
      const audio = ensure()
      if (audio === undefined) return false
      if (audio.state === 'suspended') {
        // A context the browser suspended is resumed here; the promise may
        // reject when no gesture has happened yet, which only costs the note.
        void Promise.resolve(audio.resume?.()).catch(() => {})
      }
      const startAt = audio.currentTime + 0.01
      for (const note of notesOf(tone)) {
        const at = startAt + note.offset
        if ((note.harmonics ?? 1) > 1) playStruck(audio, note, at)
        else playNote(audio, note, at)
      }
      return true
    },
    /**
     * Resume a suspended context after a user gesture.
     * @returns Nothing.
     */
    unlock() {
      const audio = ensure()
      if (audio === undefined) return
      if (audio.state === 'suspended') void Promise.resolve(audio.resume?.()).catch(() => {})
    },
    /**
     * Release the audio context.
     * @returns Nothing.
     */
    dispose() {
      const audio = context
      context = undefined
      if (audio === undefined) return
      void Promise.resolve(audio.close?.()).catch(() => {})
    },
  }
}
