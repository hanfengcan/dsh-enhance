/**
 * components/create-task-dialog.js
 */

import { createElement as h, Fragment, useState } from 'react'
import { icon } from '../icons.js'
import { Button, Dialog, Input } from '../components/primitives.js'
import { defaultTiming } from '../time-zones.js'
import { timingFromDraft } from '../schedule-format.js'
import { TaskEditorFields } from '../components/task-editor.js'

/**
 * The localized reason the Host refused a creation.
 * @param error - The Remote failure the Host answered with.
 * @returns The dictionary key of the reason.
 */
export function failureKey(error) {
  if (error === undefined || error === null || error.code !== 'schedule/input-invalid') return 'failed'
  const code = error.details === undefined || error.details === null ? undefined : error.details.code
  if (code === 'not_future') return 'notFuture'
  if (code === 'invalid_rule' || code === 'frequency_too_high'
    || code === 'invalid_time_zone' || code === 'time_out_of_range') return 'invalidRule'
  return 'failed'
}

/**
 * One creation form: the task's name, its instruction, and when it runs.
 * The destination is the Session the composer belongs to, so the form
 * names it in the execution-target row instead of offering a picker.
 * @param props - The Session, the creation action, the page opener, the
 * dismiss action, the locale seat, and the active locale reader.
 * @returns The dialog element.
 */
export function CreateTaskDialog({ sessionId, createTask, openTask, onClose, readLocaleId, t }) {
  const [draft, setDraft] = useState(() => ({
    ...defaultTiming(),
    title: '',
    prompt: '',
  }))
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState(null)
  // The ICU locale of the running interface, so the calendar month and the
  // zone names follow the language the user is reading.
  const locale = readLocaleId()

  const trimmedName = draft.title.trim()
  const trimmedInstruction = draft.prompt.trim()
  const complete = trimmedName !== '' && trimmedInstruction !== ''
  const weeklyComplete = draft.frequency !== 'weekly' || draft.weekdays.length > 0
  // The shipped form gates exactly the local rules the Host cannot guess: a
  // missing name or instruction, and a weekly rule without a weekday. A past
  // moment or a malformed custom rule is the Host's refusal, and the dialog
  // reports that refusal the way the shipped one reports it.
  const blocked = pending || !complete || !weeklyComplete

  const change = (patch) => {
    setDraft(current => ({ ...current, ...patch }))
    setFailure(null)
  }

  const submit = () => {
    if (blocked) return
    setPending(true)
    setFailure(null)
    createTask({
      title: trimmedName,
      prompt: trimmedInstruction,
      timing: timingFromDraft(draft, true),
      target: { kind: 'session', sessionId },
    }).then((outcome) => {
      setPending(false)
      if (outcome.created !== undefined) {
        openTask(sessionId, outcome.created.id)
        onClose()
        return
      }
      setFailure(outcome.failed)
    })
  }

  return h(Dialog, {
    open: true,
    onClose: () => { if (!pending) onClose() },
    closeLabel: t('cancel'),
    title: t('dialogTitle'),
    footer: h(Fragment, null,
      h(Button, {
        variant: 'outline', disabled: pending, 'data-session-schedule-action': 'cancel',
        onClick: () => { onClose() },
      }, t('cancel')),
      h(Button, {
        variant: 'primary', disabled: blocked, 'data-session-schedule-action': 'create',
        onClick: submit,
      }, pending ? t('creating') : t('create')),
    ),
  },
  h('fieldset', {
    className: 'dsh-enhance-taskEditor',
    disabled: pending,
  },
  h('label', { className: 'dsh-enhance-editorField' },
    t('taskName'),
    h(Input, {
      value: draft.title,
      maxLength: 120,
      'aria-label': t('taskName'),
      placeholder: t('taskNamePlaceholder'),
      'data-modal-autofocus': true,
      onChange: (event) => { change({ title: event.target.value }) },
    })),
  h('label', { className: 'dsh-enhance-editorField' },
    t('instruction'),
    h('textarea', {
      className: 'dsh-enhance-instruction',
      value: draft.prompt,
      'aria-label': t('instruction'),
      placeholder: t('instructionPlaceholder'),
      onChange: (event) => { change({ prompt: event.target.value }) },
    })),
  h('div', { className: 'dsh-enhance-ruleRows' },
    h('div', { className: 'dsh-enhance-ruleRow' },
      h('span', { className: 'dsh-enhance-ruleLabel' }, t('target')),
      h('span', { className: 'dsh-enhance-ruleValueFace dsh-enhance-ruleControl' },
        h('span', { className: 'dsh-enhance-ruleCurrent' }, t('targetCurrent')),
        icon('dsw-icon-chevron-down-outline-regular', 14)))),
  h(TaskEditorFields, {
    draft,
    onChange: change,
    disabled: pending,
    t,
    locale,
  }),
  draft.frequency === 'advanced'
    ? h('div', { className: 'dsh-enhance-editorField' },
      h('label', { className: 'dsh-enhance-editorField' },
        t('customRule'),
        h('textarea', {
          className: 'dsh-enhance-instruction',
          value: draft.rrule,
          'aria-label': t('customRule'),
          onChange: (event) => { change({ rrule: event.target.value }) },
        })))
    : null,
  failure !== null
    ? h('p', { className: 'dsh-enhance-error', role: 'alert' }, t(failure))
    : null))
}

