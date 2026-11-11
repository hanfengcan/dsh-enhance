/**
 * icons.js
 */

import { createElement as h } from 'react'

/**
 * Render one product icon: the Host's document sprite owns the artwork, so
 * the element is the shipped icon's own shell — a sized frame around a
 * `<use>` of the sprite symbol. A theme that replaces the artwork replaces
 * it here too.
 * @param symbol - The sprite symbol id, e.g. `dsw-icon-clock-outline-regular`.
 * @param size - The rendered edge in pixels.
 * @param className - Optional class on the frame.
 * @returns The icon element.
 */
export function icon(symbol, size = 16, className) {
  return h('svg', {
    width: size, height: size, className, 'data-icon': symbol, 'aria-hidden': 'true',
  }, h('use', { href: `#${symbol}` }))
}

/**
 * Draw the 14px calendar outline the Date row's trigger carries.
 *
 * The shared product icon set has no calendar glyph, so the shipped
 * schedule package draws the one its own picker needs, at that set's
 * regular 1px stroke. The paths are copied with it.
 * @param className - Extra class for layout placement; color rides currentColor.
 * @returns The decorative glyph.
 */
export function calendarIcon(className) {
  return h('svg', {
    width: 14, height: 14, className, viewBox: '0 0 14 14', fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true', strokeWidth: '1',
  },
  h('rect', { x: 1.4, y: 2.6, width: 11.2, height: 10, rx: 1.6, stroke: 'currentColor' }),
  h('path', { d: 'M1.4 5.6H12.6', stroke: 'currentColor' }),
  h('path', { d: 'M4.4 1.4V3.6M9.6 1.4V3.6', stroke: 'currentColor' }))
}

