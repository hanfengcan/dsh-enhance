/**
 * components/dock-entry.js
 */

import { createElement as h, Fragment, useState } from 'react'
import { icon } from '../icons.js'
import { CreateTaskDialog } from '../components/create-task-dialog.js'

/**
 * The composer-dock entry: one pill that opens the creation form for the
 * conversation this composer belongs to.
 * @param props - The Session this composer shows, the creation action, the
 * page opener, the access answer, the locale seat, and the locale reader.
 * @returns The entry element.
 */
export function SessionScheduleDockEntry({ sessionId, createTask, openTask, useRemoteAccess, readLocaleId, t }) {
  // `schedule/create` is a global-resource endpoint, so the global seat
  // answers it; the entry stays hidden while the Peer may not create.
  const allowed = useRemoteAccess('schedule/create')
  const [open, setOpen] = useState(false)
  if (!allowed) return null
  return h(Fragment, null,
    h('span', { className: 'dsh-enhance-anchor', 'data-composer-stat': 'session-schedule' },
      h('button', {
        type: 'button', className: 'dsh-enhance-pill',
        'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-label': t('action'),
        // The dock truncates a long reading; the title keeps the full name
        // one hover away, the way the shipped pills keep their reading.
        title: t('action'),
        'data-session-schedule': sessionId,
        onClick: () => { setOpen(true) },
      },
      icon('dsw-icon-clock-outline-regular', 14),
      h('span', { className: 'dsh-enhance-pill-label' }, t('action'))),
    ),
    open
      ? h(CreateTaskDialog, {
        sessionId, createTask, openTask, readLocaleId, onClose: () => { setOpen(false) }, t,
      })
      : null,
  )
}

