export type ThemeMode = "light" | "dark";

/** Set true to restore the switch-to-light theme control. */
export const ENABLE_LIGHT_THEME_TOGGLE = false;

export function isThemeToggleVisible(mode: ThemeMode): boolean {
  return ENABLE_LIGHT_THEME_TOGGLE || mode === "light";
}
