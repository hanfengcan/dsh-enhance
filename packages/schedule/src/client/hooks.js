/**
 * hooks.js
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Elements the dialog can move the keyboard to. */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'

/**
 * Move the keyboard to a control without painting a focus ring, and give
 * the ring back once the user navigates by keyboard.
 * @param element - The control receiving focus.
 * @returns Nothing.
 */
function focusWithoutRing(element) {
  if (element === null || element === undefined) return
  const release = () => {
    element.removeAttribute('data-dsh-automatic-focus')
    element.removeEventListener('blur', release)
    element.removeEventListener('keydown', release, true)
  }
  element.setAttribute('data-dsh-automatic-focus', '')
  element.addEventListener('blur', release)
  element.addEventListener('keydown', release, true)
  element.focus()
  if (!element.matches(':focus')) release()
}

/**
 * The dialog layers of one document, so only the frontmost one owns Escape
 * and the Tab ring.
 */
const dialogLayers = new WeakMap()

/**
 * Give the frontmost dialog the Escape and Tab ownership, and hand the
 * keyboard back to the control that opened it.
 * @param dialogRef - The mounted dialog element.
 * @param open - Whether the dialog is showing.
 * @param onClose - The dialog's close action.
 * @returns Nothing.
 */
export function useDialogLayer(dialogRef, open, onClose) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useLayoutEffect(() => {
    const element = dialogRef.current
    if (!open || element === null || element === undefined) return undefined
    const doc = element.ownerDocument
    const stack = dialogLayers.get(doc) ?? []
    dialogLayers.set(doc, stack)
    const layer = { element, close: () => { closeRef.current() } }
    stack.push(layer)
    const previous = doc.activeElement
    const initial = element.querySelector('[data-modal-autofocus]')
      ?? element.querySelector(FOCUSABLE)
      ?? element
    if (!element.contains(doc.activeElement)) focusWithoutRing(initial)
    const keydown = (event) => {
      if (stack[stack.length - 1] !== layer || event.defaultPrevented) return
      if (event.isComposing || event.keyCode === 229) return
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key === 'Escape' && !event.shiftKey) {
        event.preventDefault()
        if (!event.repeat) closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      // A portaled menu owns the traversal while it holds the keyboard.
      if (doc.activeElement?.closest('[role="menu"]')) return
      const items = [...element.querySelectorAll(FOCUSABLE)]
        .filter(item => !item.closest('[inert], [hidden]'))
      const first = items[0] ?? element
      const last = items[items.length - 1] ?? element
      const atEdge = event.shiftKey ? doc.activeElement === first : doc.activeElement === last
      if (doc.activeElement === element || !element.contains(doc.activeElement) || atEdge) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      }
    }
    doc.addEventListener('keydown', keydown)
    return () => {
      doc.removeEventListener('keydown', keydown)
      const wasTop = stack[stack.length - 1] === layer
      stack.splice(stack.indexOf(layer), 1)
      if (stack.length === 0) dialogLayers.delete(doc)
      if (wasTop && previous instanceof HTMLElement && previous.isConnected) {
        focusWithoutRing(previous)
      }
    }
  }, [dialogRef, open])
}

/**
 * Whether the current browser is a phone or tablet, so a portaled menu
 * does not steal the keyboard from a search field the user is typing in.
 * @returns True for a recognized mobile device.
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const { userAgent, platform, maxTouchPoints } = navigator
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1)
}

/**
 * Keep a fixed-position floating element anchored to its trigger: measure
 * the anchor, offset the panel below it, clamp the result inside the
 * viewport, and follow the anchor on scroll and resize.
 * @param options - The open state, the two refs, the alignment, and the
 * gap and margin distances.
 * @returns The panel's fixed coordinates, or null before the first measure.
 */
export function useAnchoredPosition({ open, anchorRef, panelRef, align = 'start', gap = 4, margin = 12 }) {
  const [position, setPosition] = useState(null)
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return undefined
    }
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const panel = panelRef.current
      const width = panel?.offsetWidth ?? 0
      const height = panel?.offsetHeight ?? 0
      let left = align === 'end' ? rect.right - width : rect.left
      let top = rect.bottom + gap
      if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin)
      if (height > 0) top = Math.min(Math.max(top, margin), window.innerHeight - height - margin)
      setPosition(current => current?.left === left && current.top === top ? current : { left, top })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchorRef, panelRef, align, gap, margin])
  return position
}

/**
 * Close an open popover when a pointer press lands outside its root.
 * @param root - The element holding the trigger.
 * @param open - Whether the surface is showing.
 * @param onClose - The dismissal callback.
 * @param portal - The portaled surface, which counts as inside.
 * @returns Nothing.
 */
export function useDismissOnOutsidePointer(root, open, onClose, portal) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (event.target instanceof Node
        && root.current?.contains(event.target) !== true
        && portal?.current?.contains(event.target) !== true) {
        closeRef.current()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => { document.removeEventListener('pointerdown', closeOutside) }
  }, [root, open, portal])
}

