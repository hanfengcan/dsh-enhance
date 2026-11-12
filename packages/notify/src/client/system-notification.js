/**
 * system-notification.js
 *
 * The system notification. The browser's Notification API is what raises a
 * Windows toast, both in the browser and in the desktop shell, so the
 * component needs no native code and no dependency.
 */

/**
 * The system notifier.
 * @param options - The Notification implementation and the focus action,
 * injectable for tests.
 * @returns The notifier.
 */
export function createSystemNotifier(options = {}) {
  const {
    notificationApi = globalThis.Notification,
    focusWindow = () => { globalThis.focus?.() },
  } = options

  return {
    /**
     * The permission this environment holds for notifications.
     * @returns `granted`, `denied`, `default`, or `unsupported`.
     */
    permission() {
      if (notificationApi === undefined) return 'unsupported'
      return notificationApi.permission ?? 'default'
    },
    /**
     * Raise one notification.
     *
     * The permission is asked for the first time a notification is wanted, so
     * the question arrives with the first finished reply rather than at load.
     * @param title - the notification title.
     * @param body - the notification body.
     * @returns `shown`, `denied`, `unsupported`, or `failed`.
     */
    async show(title, body) {
      if (notificationApi === undefined) return 'unsupported'
      const permission = notificationApi.permission ?? 'default'
      if (permission === 'denied') return 'denied'
      if (permission === 'default') {
        let granted
        try {
          granted = await notificationApi.requestPermission()
        } catch {
          return 'denied'
        }
        if (granted !== 'granted') return 'denied'
      }
      try {
        const notification = new notificationApi(title, {
          body,
          // The chime already made the noise; the toast only has to be seen.
          silent: true,
          tag: 'dsh-enhance-notify',
        })
        // Clicking the toast brings the window back to the front.
        notification.onclick = () => { focusWindow() }
        return 'shown'
      } catch {
        return 'failed'
      }
    },
  }
}
