/**
 * row-identity.js
 *
 * The two names the Plugins page knows this component by.
 *
 * The configuration page rides the `plugins.row.config` seat, whose key is
 * `<bundle package name>#<row id>`. The row id is the `id` this bundle's
 * `cordis.patch.yml` declares for this component — the same id the profile
 * uses to switch the component off — so the two must agree.
 */

/** The bundle's package name. */
export const BUNDLE_NAME = 'dsh-enhance'

/** The row id this component's patch line declares. */
export const ROW_ID = 'dsh-enhance-notify'

/** The key the configuration page registers under. */
export const ROW_CONFIG_KEY = `${BUNDLE_NAME}#${ROW_ID}`
