/**
 * id-counter.js
 */

let counter = 0

/**
 * A process-unique id for the controls the rule rows label themselves with.
 *
 * The counter lives in its own module so every row can mint ids without
 * owning the shared state.
 *
 * @param prefix - The prefix that keeps the ids of different row kinds apart.
 * @returns The generated id.
 */
export function nextId(prefix) {
  counter += 1
  return `${prefix}-${counter}`
}
