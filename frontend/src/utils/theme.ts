import { useEffect, useState } from "react";

/*
 * Dark or light. Follows the device until you pick one in your settings; the
 * pick is kept on this device. index.html sets it before anything paints, so
 * there's no flash of the wrong one; this keeps it right afterwards.
 */

export type ThemeChoice = "dark" | "light" | "system";
export type Theme = "dark" | "light";

const KEY = "jqzz.theme";
const EVENT = "jqzz-theme";
const DEVICE = "(prefers-color-scheme: light)";

export function themeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function resolve(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return window.matchMedia(DEVICE).matches ? "light" : "dark";
}

function apply() {
  const theme = resolve(themeChoice());
  if (document.documentElement.dataset.theme === theme) return;
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(EVENT));
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: it holds for this visit only */
  }
  // a crossfade instead of a snap, only for the moment of switching
  const root = document.documentElement;
  root.classList.add("theme-switching");
  window.setTimeout(() => root.classList.remove("theme-switching"), 420);
  if (choice !== "system") {
    document.documentElement.dataset.theme = choice;
    window.dispatchEvent(new Event(EVENT));
  } else {
    apply();
  }
  window.dispatchEvent(new Event(`${EVENT}-choice`));
}

/** Once, at start: keeps following the device while nothing's been picked. */
export function watchTheme() {
  apply();
  window.matchMedia(DEVICE).addEventListener("change", () => {
    if (themeChoice() === "system") apply();
  });
  // picked in another tab: this one follows
  window.addEventListener("storage", (e) => {
    if (e.key === FONTS_KEY || e.key === null) applyFonts(fontsChoice());
    if (e.key !== KEY && e.key !== null) return;
    apply();
    window.dispatchEvent(new Event(`${EVENT}-choice`));
  });
}

/*
 * Cleaner fonts: the blackletter titles and the brush questions swapped for
 * the plain sans the rest of the app uses. Kept on this device, like the theme.
 */
export type Fonts = "classic" | "clean";
const FONTS_KEY = "jqzz.fonts";
const FONTS_EVENT = "jqzz-fonts";

export function fontsChoice(): Fonts {
  try {
    return localStorage.getItem(FONTS_KEY) === "clean" ? "clean" : "classic";
  } catch {
    return "classic";
  }
}

function applyFonts(fonts: Fonts) {
  if (fonts === "clean") document.documentElement.dataset.fonts = "clean";
  else delete document.documentElement.dataset.fonts;
  window.dispatchEvent(new Event(FONTS_EVENT));
}

export function setFonts(fonts: Fonts) {
  try {
    if (fonts === "clean") localStorage.setItem(FONTS_KEY, "clean");
    else localStorage.removeItem(FONTS_KEY);
  } catch {
    /* storage blocked: it holds for this visit only */
  }
  applyFonts(fonts);
}

export function useFonts() {
  const [fonts, setState] = useState<Fonts>(fontsChoice);
  useEffect(() => {
    const sync = () => setState(fontsChoice());
    window.addEventListener(FONTS_EVENT, sync);
    return () => window.removeEventListener(FONTS_EVENT, sync);
  }, []);
  return { fonts, set: setFonts };
}

/** Calls back whenever the theme in use changes, for things drawn from its colours. */
export function onThemeChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function useTheme() {
  const [state, setState] = useState(() => ({ choice: themeChoice(), theme: currentTheme() }));
  useEffect(() => {
    const sync = () => setState({ choice: themeChoice(), theme: currentTheme() });
    window.addEventListener(EVENT, sync);
    window.addEventListener(`${EVENT}-choice`, sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener(`${EVENT}-choice`, sync);
    };
  }, []);
  return { ...state, set: setThemeChoice };
}
