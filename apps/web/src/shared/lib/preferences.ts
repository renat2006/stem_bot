import { useSyncExternalStore } from "react";
import { applyThemeAppearance } from "./telegram.js";

export type ColorSchemePreference = "system" | "light" | "dark";
export type ContrastPreference = "normal" | "high";

export interface UserPreferences {
  colorScheme: ColorSchemePreference;
  contrast: ContrastPreference;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
}

const listeners = new Set<() => void>();
let cached: UserPreferences | null = null;

function readPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return { colorScheme: "system", contrast: "normal", reducedMotion: false, hapticsEnabled: true };
  }
  try {
    const rawScheme = localStorage.getItem("color-scheme");
    const colorScheme: ColorSchemePreference =
      rawScheme === "light" || rawScheme === "dark" ? rawScheme : "system";
    const contrast: ContrastPreference = localStorage.getItem("stem_contrast") === "high" ? "high" : "normal";
    const reducedMotion = localStorage.getItem("stem_reduced_motion") === "1";
    const hapticsEnabled = localStorage.getItem("stem_haptics") !== "0";
    return { colorScheme, contrast, reducedMotion, hapticsEnabled };
  } catch {
    return { colorScheme: "system", contrast: "normal", reducedMotion: false, hapticsEnabled: true };
  }
}

function getSnapshot(): UserPreferences {
  if (!cached) cached = readPreferences();
  return cached;
}

function emit() {
  cached = readPreferences();
  for (const listener of listeners) listener();
}

export function syncPreferencesToDom(prefs: UserPreferences = getSnapshot()) {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", prefs.colorScheme === "system" ? "light dark" : prefs.colorScheme);
  }
  const resolved =
    prefs.colorScheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : prefs.colorScheme;
  applyThemeAppearance(resolved);

  if (prefs.contrast === "high") {
    document.documentElement.dataset.contrast = "high";
  } else {
    delete document.documentElement.dataset.contrast;
  }

  if (prefs.reducedMotion) {
    document.documentElement.dataset.reducedMotion = "true";
  } else {
    delete document.documentElement.dataset.reducedMotion;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", () => {
    emit();
    syncPreferencesToDom();
  });
}

export function setColorSchemePreference(next: ColorSchemePreference) {
  try {
    if (next === "system") {
      localStorage.removeItem("color-scheme");
    } else {
      localStorage.setItem("color-scheme", next);
    }
  } catch {}
  emit();
  syncPreferencesToDom();
}

export function setContrastPreference(next: ContrastPreference) {
  try {
    if (next === "high") localStorage.setItem("stem_contrast", "high");
    else localStorage.removeItem("stem_contrast");
  } catch {}
  emit();
  syncPreferencesToDom();
}

export function setReducedMotionPreference(next: boolean) {
  try {
    if (next) localStorage.setItem("stem_reduced_motion", "1");
    else localStorage.removeItem("stem_reduced_motion");
  } catch {}
  emit();
  syncPreferencesToDom();
}

export function setHapticsPreference(next: boolean) {
  try {
    if (!next) localStorage.setItem("stem_haptics", "0");
    else localStorage.removeItem("stem_haptics");
  } catch {}
  emit();
}

export function areHapticsEnabled(): boolean {
  return getSnapshot().hapticsEnabled;
}

export function usePreferences(): UserPreferences {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot,
    getSnapshot,
  );
}

export function useMotionEnabled(): boolean {
  const { reducedMotion } = usePreferences();
  if (reducedMotion) return false;
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
