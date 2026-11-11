/**
 * dsh-enhance-schedule component, browser half — source.
 *
 * This module is the source of the browser artifact, not the artifact itself:
 * the build wraps its default export in the `window.__ModuleLoader__.load({ id,
 * factory })` handoff the Host expects, and stamps the package name as the
 * module id (see `tsdown.config.mjs`).
 *
 * A composer-dock entry that creates an automation task **for the conversation
 * the composer belongs to**. The Host Schedule service already owns tasks and
 * accepts a `session` destination, so the browser half only asks for one
 * through the Remote gateway and then shows it in the official right-Sidebar
 * page.
 *
 * The entry lives in the dock under the input box, the row that already
 * carries the session's statistics: the Session a task is created for is the
 * one on screen, so there is no session picker and no ambiguity about which
 * conversation receives the delivery. The task is an ordinary Automation task —
 * the form asks for an instruction and a time, not for a "resume" — and it
 * appears next to every other task in the shipped Automation tasks page.
 *
 * The rule editor is the shipped one, ported: the same rows in the same
 * order, the same eight repeat choices, the same self-drawn month calendar and
 * clock picker, the same searchable time-zone menu, and the same RFC 5545
 * rule text the Host stores. Only the destination differs — this plugin always
 * runs the task in the conversation it sits in, so the target row names that
 * session instead of opening a menu.
 *
 * The plugin owns its own controls. It imports no Harness Client package: the
 * dialog, the button, the input, the menu and the pickers are local copies of
 * the shipped ones, with this plugin's class names and the Host theme's tokens
 * as the only styling dependency. The product icons are the Host's own sprite
 * symbols, referenced the way the shipped icons reference them; the calendar
 * glyph the shipped date row carries is the one the schedule package draws for
 * itself, copied with its paths.
 */

import { NS, en, zh } from './locales.js'
import { STYLE_ID, STYLE_TEXT } from './styles.js'
import { failureKey } from './components/create-task-dialog.js'
import { SessionScheduleDockEntry } from './components/dock-entry.js'

/**
 * The page kind the shipped Automation tasks page registers for one task.
 * The kind is the key of its declared navigation parameters, so the string
 * is part of that page's public contract.
 */
const TASK_TAB_KIND = 'scheduleTask'

export default {
  inject: ['slots', 'locale', 'remote', 'remote.schedule', 'remoteAccess', 'sidebarRight'],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-enhance-schedule: dictionaries')
    ctx.effect(() => {
      const sheet = document.createElement('style')
      sheet.id = STYLE_ID
      // The module system removes `style[data-plugin]` tags when the entry
      // is unloaded, so the sheet leaves with the plugin.
      sheet.dataset.plugin = 'dsh-enhance-schedule'
      sheet.textContent = STYLE_TEXT
      document.head.append(sheet)
      return () => { sheet.remove() }
    }, 'dsh-enhance-schedule: styles')

    /**
     * Ask the Host Schedule service for one task bound to a Session.
     * @param request - The task's title, instruction, timing and destination.
     * @returns The created task, or the localized reason the Host refused.
     */
    const createTask = async (request) => {
      try {
        const result = await ctx.remote.schedule.create(request)
        if (result.ok) return { created: result.value }
        return { failed: failureKey(result.error) }
      } catch (error) {
        // A dropped connection leaves the outcome unknown; the draft stays
        // on screen and the reason is the generic one.
        console.warn('dsh-enhance-schedule: create failed:', error)
        return { failed: 'failed' }
      }
    }

    /**
     * Show one created task in the official right-Sidebar page.
     * @param sessionId - The Session the task delivers to.
     * @param id - The created task.
     * @returns Nothing.
     */
    const openTask = (sessionId, id) => {
      try {
        ctx.sidebarRight.openTab(TASK_TAB_KIND, { params: { sessionId, id } })
      } catch (error) {
        // No Session surface is mounted, so the column cannot host the
        // page; the task itself exists and shows in Automation tasks.
        console.warn('dsh-enhance-schedule: could not open the task page:', error)
      }
    }

    ctx.remoteAccess.whenAccess('schedule/create', function* () {
      yield ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'dsh-enhance-schedule-task',
        // After the shipped statistics pills (activity 0, usage 1).
        order: 2,
        locale: NS,
        inject: () => ({
          createTask,
          openTask,
          // Read on every render, so a language switch names the zone in
          // the new language without re-injecting the entry.
          readLocaleId: () => ctx.locale.getSnapshot().active,
        }),
      }, SessionScheduleDockEntry))
    })
  },
}


