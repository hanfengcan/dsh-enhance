/**
 * styles.js
 *
 * The configuration page's own skin.
 *
 * The page follows the Host's settings conventions: the settings-card
 * material (a hairline stroke, the R20 corner, the layer fill), the
 * ConfigField row shape (a label with its control on the same line, the
 * explanation under it, a hairline between the rows), and the shipped control
 * geometry — the switch is the Host's switch, and the picker is the Host's
 * input row with a chevron.
 *
 * Only semantic tokens are used: no colour literal, no local radius scale.
 */

/** Style id of this plugin's sheet; one sheet serves every page it draws. */
export const STYLE_ID = 'dsh-enhance-notify-styles'

export const STYLE_TEXT = `
/* The settings card: the material every settings card in the Host wears. */
.dsh-enhance-notify-page {
  display: flex;
  flex-direction: column;
  max-width: 560px;
  padding: 0 16px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-settings-card-fill);
}

/* One field: the label and its control on one line, the explanation under
   it, and a hairline between the fields. */
.dsh-enhance-notify-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
}
.dsh-enhance-notify-field + .dsh-enhance-notify-field {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.dsh-enhance-notify-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dsh-enhance-notify-label {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
}
.dsh-enhance-notify-hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

/* The switch: the Host's switch geometry (36×20, a capsule track and a round
   thumb), drawn here because the plugin owns its own controls. */
.dsh-enhance-notify-switch {
  box-sizing: border-box;
  position: relative;
  flex: 0 0 auto;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  corner-shape: round;
  background: var(--dsw-alias-border-l3);
  cursor: pointer;
}
.dsh-enhance-notify-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }
.dsh-enhance-notify-switch:disabled { cursor: default; opacity: 0.5; }
.dsh-enhance-notify-switch:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dsh-enhance-notify-thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--dsw-alias-switch-thumb);
  transition: transform 120ms ease;
}
.dsh-enhance-notify-switch[aria-checked='true'] .dsh-enhance-notify-thumb {
  background: var(--dsw-alias-label-primary-foreground);
  transform: translateX(16px);
}

/* The tone picker: the Host's input row, with the chevron that says it opens. */
.dsh-enhance-notify-select {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsh-enhance-notify-select:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-enhance-notify-select:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dsh-enhance-notify-selectIcon {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-enhance-notify-selectIcon svg { width: 14px; height: 14px; }

/* The menu: the Host's menu material — an elevated surface with no border of
   its own, R16 around, R12 rows. */
.dsh-enhance-notify-menu {
  position: fixed;
  z-index: 1100;
  min-width: 168px;
  padding: 4px;
  border: 0;
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
}
.dsh-enhance-notify-menuItem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.dsh-enhance-notify-menuItem:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-enhance-notify-menuItem:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dsh-enhance-notify-menuCheck {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--dsw-alias-label-secondary);
}
.dsh-enhance-notify-menuCheck svg { width: 14px; height: 14px; }

/* The page's own button: the Host's ghost button in its small size. */
.dsh-enhance-notify-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsh-enhance-notify-button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-enhance-notify-button:active { background: var(--dsw-alias-interactive-bg-active); }
.dsh-enhance-notify-button:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
`
