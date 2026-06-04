export type ThemeMode = "light" | "dark";

/** Set true to restore the switch-to-light theme control. */
const ENABLE_LIGHT_THEME_TOGGLE = false;

export function isThemeToggleVisible(_mode: ThemeMode): boolean {
  return ENABLE_LIGHT_THEME_TOGGLE;
}
