/**
 * dsh-enhance-notify component, browser half — source.
 *
 * This module is the source of the browser artifact, not the artifact itself:
 * the build wraps its default export in the `window.__ModuleLoader__.load({ id,
 * factory })` handoff the Host expects, and stamps the package name as the
 * module id (see `tsdown.config.mjs`).
 *
 * The component answers one question: *did the agent finish?* The Host
 * forwards `api-session/status` whenever an Agent changes running state, so a
 * `running` edge from true back to false is one finished turn. On that edge
 * the component plays a chime and — while the window is in the background —
 * raises a system notification, which is what a Windows toast is.
 *
 * The component owns its own controls: the two switches on its configuration
 * page are drawn here, with the Host theme's tokens as the only styling
 * dependency. It imports no Harness Client package.
 * @module dsh-enhance-notify/client
 */

import { NS, en, zh } from './locales.js'
import { ROW_CONFIG_KEY } from './row-identity.js'
import { STYLE_ID, STYLE_TEXT } from './styles.js'
import { createChime } from './chime.js'
import { createSystemNotifier } from './system-notification.js'
import { createSettingsStore } from './settings.js'
import { NotifySettingsPage } from './components/settings-page.js'

export default {
  inject: ['remote', 'sessions', 'slots', 'locale'],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-enhance-notify: dictionaries')
    ctx.effect(() => {
      const sheet = document.createElement('style')
      sheet.id = STYLE_ID
      // The module system removes `style[data-plugin]` tags when the entry
      // is unloaded, so the sheet leaves with the plugin.
      sheet.dataset.plugin = 'dsh-enhance-notify'
      sheet.textContent = STYLE_TEXT
      document.head.append(sheet)
      return () => { sheet.remove() }
    }, 'dsh-enhance-notify: styles')

    const t = ctx.locale.bind(NS)
    const settings = createSettingsStore()
    const chime = createChime()
    const notifier = createSystemNotifier()

    // A suspended audio context is resumed by the first gesture, so the chime
    // is ready by the time a reply can finish.
    ctx.effect(() => {
      const unlock = () => { chime.unlock() }
      window.addEventListener('pointerdown', unlock)
      window.addEventListener('keydown', unlock)
      return () => {
        window.removeEventListener('pointerdown', unlock)
        window.removeEventListener('keydown', unlock)
        chime.dispose()
      }
    }, 'dsh-enhance-notify: audio')

    /**
     * The list row of one session, when the client knows it.
     * @param sessionId - the session to look up.
     * @returns the row, or undefined.
     */
    const sessionRow = (sessionId) => {
      try {
        return ctx.sessions?.list?.getSnapshot()?.byId?.[sessionId]
      } catch {
        return undefined
      }
    }

    /**
     * The title one finished session is known by.
     * @param sessionId - the session to look up.
     * @returns the title, or undefined.
     */
    const sessionTitle = (sessionId) => {
      const row = sessionRow(sessionId)
      const title = row?.title
      return typeof title === 'string' && title.trim() !== '' ? title : undefined
    }

    /**
     * Announce one finished reply.
     * @param sessionId - the session that finished.
     * @returns Nothing.
     */
    const announce = (sessionId) => {
      const state = settings.get()
      if (state.sound) chime.play(state.tone)
      if (!state.system) return
      // A toast for a reply the user is watching is noise, not a signal.
      if (globalThis.document?.hasFocus?.() !== false) return
      const title = sessionTitle(sessionId)
      const body = title === undefined
        ? t('notificationBodyFallback')
        : t('notificationBody', { title })
      void notifier.show(t('notificationTitle'), body)
    }

    // One `running` edge per Session: the Agent going idle after a turn.
    const running = new Set()
    ctx.effect(() => {
      const off = ctx.remote.$on('api-session/status', (sessionId, isRunning) => {
        if (isRunning === true) {
          running.add(sessionId)
          return
        }
        if (!running.delete(sessionId)) return
        const row = sessionRow(sessionId)
        // A subagent's own turn is not a reply to the user.
        if (row?.origin === 'subagent' || row?.parentSessionId !== undefined) return
        announce(sessionId)
      })
      return () => { off() }
    }, 'dsh-enhance-notify: session status')

    ctx.effect(() => {
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        // The key is `<bundle package name>#<row id>`: the Plugins page
        // matches it against the row it is showing, so this is how the page
        // knows the configuration in front of it belongs to this component.
        key: ROW_CONFIG_KEY,
        locale: NS,
        inject: () => ({ settings, chime }),
      }, NotifySettingsPage))
    }, 'dsh-enhance-notify: configuration page')
  },
}
