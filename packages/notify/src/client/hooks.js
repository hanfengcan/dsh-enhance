/**
 * hooks.js
 *
 * The two behaviors the settings panel needs: it closes when the pointer lands
 * outside it, and it closes on Escape. The panel is this component's own
 * overlay, so it only ever competes with itself.
 */

import { useEffect } from 'react'

/**
 * Close the panel when a pointer press lands outside it.
 * @param ref - the panel's anchor element.
 * @param onDismiss - the close action.
 * @param active - whether the panel is open.
 * @param panelRef - the panel's own element, when it is rendered elsewhere
 *   (a portal): a press inside it belongs to the panel, not to the outside.
 * @returns Nothing.
 */
export function useDismissOnOutsidePointer(ref, onDismiss, active, panelRef) {
  useEffect(() => {
    if (!active) return undefined
    const onPointerDown = (event) => {
      const anchor = ref.current
      const panel = panelRef === undefined ? anchor : panelRef.current
      const target = event.target
      if (target instanceof Node) {
        if (anchor !== null && anchor !== undefined && anchor.contains(target)) return
        if (panel !== null && panel !== undefined && panel.contains(target)) return
      }
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [ref, panelRef, onDismiss, active])
}

/**
 * Close the panel when Escape is pressed.
 * @param onDismiss - the close action.
 * @param active - whether the panel is open.
 * @returns Nothing.
 */
export function useDismissOnEscape(onDismiss, active) {
  useEffect(() => {
    if (!active) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onDismiss, active])
}
