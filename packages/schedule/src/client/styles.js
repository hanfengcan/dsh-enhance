/**
 * styles.js
 */



/** Style id of this plugin's sheet; one sheet serves every dialog it opens. */
export const STYLE_ID = 'dsh-enhance-styles'

export const STYLE_TEXT = `
/* The dialog is the Host's own modal treatment: a full-viewport layer with a
   translucent mask and a centered card. */
.dsh-enhance-modal-root {
  pointer-events: auto;
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(24px, var(--dsh-frame-overlay-top, 24px)) 24px;
}
.dsh-enhance-modal-mask {
  position: absolute;
  inset: var(--dsh-frame-chrome-top, 0px) 0 0;
  backdrop-filter: var(--dsw-mask-blur);
}
.dsh-enhance-modal-mask::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--dsw-alias-bg-mask-1);
  animation: dsh-enhance-modal-enter var(--ds-transition-duration) var(--ds-ease-in-out);
}
.dsh-enhance-modal-card {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(520px, 100%);
  padding: 0 0 24px;
  overflow: hidden;
  border: 0;
  border-radius: var(--dsw-radius-panel);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  animation: dsh-enhance-modal-enter var(--ds-transition-duration) var(--ds-ease-in-out);
}
@keyframes dsh-enhance-modal-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-enhance-modal-mask::after, .dsh-enhance-modal-card { animation: none; }
}
.dsh-enhance-modal-card:focus { outline: none; }
.dsh-enhance-modal-content { display: flex; flex-direction: column; width: 100%; }
.dsh-enhance-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 22px 14px 12px 24px;
}
.dsh-enhance-modal-title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}
.dsh-enhance-modal-close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary);
}
@media (hover: hover) {
  .dsh-enhance-modal-close:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-modal-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-top: 20px;
  padding: 0 24px;
}
.dsh-enhance-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 24px;
}

/* Buttons carry the Host's control geometry and its token-backed variants. */
.dsh-enhance-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.dsh-enhance-button:disabled { cursor: not-allowed; opacity: 0.4; }
.dsh-enhance-button-primary {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
@media (hover: hover) {
  .dsh-enhance-button-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
  .dsh-enhance-button-ghost:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-button-ghost:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
/* The transparent border preserves layout; the inset stroke stays complete at
   fractional widths. */
.dsh-enhance-button-outline {
  border: 0.5px solid transparent;
  background: transparent;
  box-shadow: inset 0 0 0 var(--dsh-hairline-width, 0.5px) var(--dsh-button-outline-color, var(--dsw-alias-border-l3));
}
@media (hover: hover) {
  .dsh-enhance-button-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}

/* The text input is the Host's bordered single-line control. */
.dsh-enhance-input {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-enhance-input:focus-within { border-color: var(--dsw-alias-state-business-primary); }
.dsh-enhance-input-element {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.dsh-enhance-input-element::placeholder { color: var(--dsw-alias-label-dimmed); }

/* The form follows the shipped task editor: named fields over bordered rule
   rows, one label on the left and one value on the right. */
.dsh-enhance-taskEditor { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 20px; }
.dsh-enhance-editorField { display: grid; gap: 8px; font-size: 14px; min-width: 0; }
.dsh-enhance-editorField > h3 { margin: 0; font: inherit; }
.dsh-enhance-ruleRows {
  display: flex; flex-direction: column; padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 16px;
}
.dsh-enhance-ruleRow,
.dsh-enhance-ruleRowMenu {
  display: flex;
  width: 100%;
  border-bottom: 0.5px solid var(--dsw-alias-border-l3);
}
.dsh-enhance-ruleRow {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}
.dsh-enhance-ruleRows > :last-child { border-bottom: 0; }
.dsh-enhance-ruleLabel {
  flex: none;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 1.6;
}
.dsh-enhance-ruleControl { margin-right: 0; }
.dsh-enhance-ruleRows .dsh-enhance-ruleControl:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
/* The menu trigger is the whole row, so the row stays one click target: the
   value and the chevron sit in one face that carries the hover fill and the
   focus ring instead of the trigger's full-width box. */
.dsh-enhance-ruleValue {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
}
.dsh-enhance-ruleValueFace {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 0 8px;
  border-radius: 18px;
  transition: background 0.15s;
}
@media (hover: hover) {
  .dsh-enhance-ruleValue:not(:disabled):hover .dsh-enhance-ruleValueFace {
background: var(--dsw-alias-interactive-bg-hover);
  }
}
.dsh-enhance-ruleRows .dsh-enhance-ruleValue:focus-visible { outline: none; }
.dsh-enhance-ruleValue:focus-visible .dsh-enhance-ruleValueFace {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.dsh-enhance-ruleValueFace > svg { flex: none; color: var(--dsw-alias-label-tertiary); }
.dsh-enhance-ruleValue:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }
.dsh-enhance-ruleCurrent {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-enhance-ruleInput {
  flex: 0 1 58%;
  min-width: 0;
  padding: 5px 8px;
  margin-right: 0;
  border: none;
  border-radius: 18px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
  text-align: right;
  transition: background 0.15s;
}
@media (hover: hover) {
  .dsh-enhance-ruleInput:not(:disabled):hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-ruleInput:disabled { color: var(--dsw-alias-label-tertiary); }
/* The interval stepper and the month day sit in the settings stepper pill: a
   36px 18px-radius module-fill pill whose arrow column shows on hover. */
.dsh-enhance-ruleIntervalStepper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 36px;
  border-radius: 18px;
  background: var(--dsw-alias-bg-module-platform);
}
.dsh-enhance-ruleIntervalInput {
  flex: 0 1 auto;
  box-sizing: border-box;
  width: calc(var(--interval-digits, 1) * 1ch + 52px);
  min-width: 72px;
  height: 100%;
  padding: 0 26px;
  appearance: textfield;
  border-radius: inherit;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.dsh-enhance-ruleIntervalInput::-webkit-outer-spin-button,
.dsh-enhance-ruleIntervalInput::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}
@media (hover: hover) {
  .dsh-enhance-ruleIntervalInput:not(:disabled):hover { background: transparent; }
}
.dsh-enhance-ruleRows .dsh-enhance-ruleIntervalInput:focus-visible { outline: none; }
.dsh-enhance-ruleIntervalArrows {
  position: absolute;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0;
}
@media (hover: hover) {
  .dsh-enhance-ruleIntervalStepper:hover .dsh-enhance-ruleIntervalArrows { opacity: 1; }
}
.dsh-enhance-ruleIntervalStepper:focus-within .dsh-enhance-ruleIntervalArrows { opacity: 1; }
@media (hover: none) {
  .dsh-enhance-ruleIntervalArrows { opacity: 1; }
}
.dsh-enhance-ruleIntervalArrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 12px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 75%, transparent);
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
@media (hover: hover) {
  .dsh-enhance-ruleIntervalArrow:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-1); }
}
.dsh-enhance-ruleIntervalArrow:disabled { color: var(--dsw-alias-label-caption); cursor: default; }
/* The Date and Time rows open their picker from a read-only value button. */
.dsh-enhance-pickerTrigger {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  cursor: pointer;
}
.dsh-enhance-pickerTrigger:disabled { cursor: default; }
.dsh-enhance-pickerIcon { flex: none; color: var(--dsw-alias-label-tertiary); }
.dsh-enhance-ruleWeekdays {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  padding: 6px 0;
}
/* The weekday chip is the Host's pill: a 24px capsule in the tertiary layer. */
.dsh-enhance-weekdayPill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
}
@media (hover: hover) {
  .dsh-enhance-weekdayPill:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-weekdayPill:disabled { cursor: not-allowed; opacity: 0.4; }
.dsh-enhance-weekdayPill-active {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-button-ghost-active-fill);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border);
}
/* The instruction box: the shipped editor's own textarea, 112px resting and
   160px grown, with the neutral hairline that only the hover state brightens. */
.dsh-enhance-instruction {
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: 100%;
  min-height: 112px;
  max-height: 160px;
  field-sizing: content;
  margin: 0;
  padding: 12px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 16px;
  outline: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
  line-height: 24px;
  resize: vertical;
}
.dsh-enhance-instruction:focus { border-color: var(--dsw-alias-state-business-primary); }
.dsh-enhance-error { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-state-error-primary); }

/* The dropdown is the Host's menu card: the theme-owned material, the
   prominent elevation, and the compact menu cell. */
.dsh-enhance-menu-root { position: relative; display: inline-flex; }
.dsh-enhance-menu-list {
  box-sizing: border-box;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0;
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-menu-surface-fill);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  min-width: 144px;
  max-width: 360px;
}
/* Portal mode: fixed in the viewport, coordinates supplied inline from the
   anchor rect, so a list inside a dialog still layers above the overlay. */
.dsh-enhance-menu-portal {
  position: fixed;
  top: auto;
  left: auto;
  z-index: 1100;
}
.dsh-enhance-menu-alignEnd { left: auto; right: 0; }
.dsh-enhance-menu-scrollable {
  max-height: calc(100vh - 12px - max(12px, var(--dsh-frame-overlay-top, 12px)));
}
.dsh-enhance-menu-viewport { display: flex; flex-direction: column; min-height: 0; }
.dsh-enhance-menu-scrollable .dsh-enhance-menu-viewport { overflow-y: auto; }
.dsh-enhance-menu-header {
  flex: none;
  padding: 5px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dsh-enhance-menu-itemWrap { position: relative; }
.dsh-enhance-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  text-align: left;
}
@media (hover: hover) {
  .dsh-enhance-menu-item:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-menu-item:focus-visible:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  outline: none;
}
.dsh-enhance-menu-item:disabled { opacity: 0.4; cursor: not-allowed; }
.dsh-enhance-menu-itemIcon {
  display: inline-flex;
  flex: none;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-enhance-menu-itemIcon svg,
.dsh-enhance-menu-check { width: 14px; height: 14px; }
.dsh-enhance-menu-itemLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-enhance-menu-check { flex: none; color: var(--dsw-alias-label-primary); }
.dsh-enhance-menu-label {
  padding: 6px 8px;
  font-size: 11px;
  line-height: 15px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-enhance-menu-separator {
  height: 0.5px;
  margin: 3px 2px;
  background: var(--dsw-alias-border-l2);
}
.dsh-enhance-menu-separator + .dsh-enhance-menu-separator { display: none; }

/* The searchable zone inventory is shorter than a general menu: recent
   choices stay visible without letting the global list dominate the dialog. */
.dsh-enhance-zoneMenu {
  height: min(420px, calc(100dvh - 48px));
  max-height: min(420px, calc(100dvh - 48px));
}
.dsh-enhance-zoneMenu [role='separator'] {
  height: 0.5px;
  margin: 6px 4px;
  background: var(--dsw-alias-border-l3);
}
.dsh-enhance-zoneSearch {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  outline: none;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
}
.dsh-enhance-zoneSearch:focus { border-color: var(--dsw-alias-state-business-primary); }

/* The picker card: the theme-owned menu surface, portal-positioned from its
   trigger, with the prominent elevation the shipped pickers carry. */
.dsh-enhance-pickerPanel {
  position: fixed;
  top: auto;
  left: auto;
  box-sizing: border-box;
  z-index: 1100;
  display: flex;
  border: 0;
  border-radius: 16px;
  background: var(--dsw-menu-surface-fill);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}

/* The month calendar inside the picker card. */
.dsh-enhance-calendar {
  flex-direction: column;
  gap: 4px;
  width: 232px;
  padding: 8px;
}
.dsh-enhance-calendarHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.dsh-enhance-calendarTitle {
  flex: 1 1 auto;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
.dsh-enhance-calendarNav {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
@media (hover: hover) {
  .dsh-enhance-calendarNav:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-calendarNav:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dsh-enhance-calendarGrid { display: flex; flex-direction: column; gap: 2px; }
.dsh-enhance-calendarWeek { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dsh-enhance-calendarWeekday {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1.6;
}
.dsh-enhance-calendarCell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.6;
  cursor: pointer;
  outline: none;
}
@media (hover: hover) {
  .dsh-enhance-calendarCell:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-calendarCell:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
/* Today keeps a hairline ring; the picked day takes the active chip fill. */
.dsh-enhance-calendarCell[aria-current='date'] {
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l3);
}
.dsh-enhance-calendarSelected {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-button-ghost-active-fill);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border);
}
.dsh-enhance-calendarBlank { height: 28px; }

/* The three scrolling clock columns inside the picker card. */
.dsh-enhance-clock { flex-direction: row; gap: 2px; padding: 3px; }
.dsh-enhance-clockColumn {
  display: flex;
  flex-direction: column;
  width: 52px;
  max-height: 216px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dsh-enhance-clockOption {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border-radius: 10px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.6;
  cursor: pointer;
  outline: none;
}
@media (hover: hover) {
  .dsh-enhance-clockOption:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-enhance-clockOption:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dsh-enhance-clockSelected {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-button-ghost-active-fill);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border);
}

/* The dock entry is one of the composer's statistics pills: the same face, the
   same tertiary ink, the same hover fill the shipped pills carry. */
.dsh-enhance-anchor {
  display: inline-flex; min-width: 0;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
}
.dsh-enhance-pill {
  display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; max-width: 100%;
  padding: 1px 8px; border: none; border-radius: var(--dsw-radius-sm); background: transparent;
  color: var(--dsw-alias-label-tertiary); font: inherit; font-variant-numeric: tabular-nums;
  line-height: inherit; white-space: nowrap; cursor: pointer;
}
.dsh-enhance-pill svg { width: 14px; height: 14px; flex: none; }
.dsh-enhance-pill:hover,
.dsh-enhance-pill[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary);
}
.dsh-enhance-pill-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
`

