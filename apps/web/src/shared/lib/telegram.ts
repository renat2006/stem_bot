import {
  backButton,
  hapticFeedback,
  init,
  initData,
  isTMA,
  miniApp,
  retrieveLaunchParams,
  retrieveRawInitData,
  swipeBehavior,
  themeParams,
  viewport,
} from "@tma.js/sdk-react";
import { useEffect } from "react";

let initialized = false;

export function getRawInitData(): string {
  try {
    return retrieveRawInitData() ?? "";
  } catch {
    return "";
  }
}

export function applyThemeAppearance(mode: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-tg", mode);

  if (isTMA() && miniApp.isMounted()) {
    const bgHex = mode === "dark" ? "#0f1215" : "#f5f3ee";
    const headerHex = mode === "dark" ? "#14181c" : "#ffffff";
    const tgBg = themeParams.secondaryBgColor() ?? bgHex;
    const tgHeader = themeParams.headerBgColor() ?? themeParams.bgColor() ?? headerHex;
    if (miniApp.setHeaderColor.isAvailable()) miniApp.setHeaderColor(tgHeader);
    if (miniApp.setBgColor.isAvailable()) miniApp.setBgColor(tgBg);
    if (miniApp.setBottomBarColor.isAvailable()) miniApp.setBottomBarColor(tgBg);
  }
}

export function detectInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("color-scheme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  if (isTMA() && themeParams.isMounted()) {
    return themeParams.isDark() ? "dark" : "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStartParam(): string | null {
  try {
    const value = retrieveLaunchParams().tgWebAppStartParam;
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

export function initTelegramSdk() {
  if (typeof window === "undefined") return;

  if (!isTMA()) {
    applyThemeAppearance(detectInitialTheme());
    return;
  }

  if (initialized) return;
  initialized = true;

  try {
    init();
    if (themeParams.mount.isAvailable()) {
      themeParams.mount();
      if (themeParams.bindCssVars.isAvailable()) themeParams.bindCssVars();
    }
    if (miniApp.mount.isAvailable()) {
      miniApp.mount();
      if (miniApp.bindCssVars.isAvailable()) miniApp.bindCssVars();
    }
    if (backButton.mount.isAvailable()) {
      backButton.mount();
    }
    if (viewport.mount.isAvailable()) {
      void viewport
        .mount()
        .then(() => {
          if (viewport.expand.isAvailable()) viewport.expand();
          if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
        })
        .catch(() => {});
    }
    if (swipeBehavior.mount.isAvailable()) {
      swipeBehavior.mount();
      if (swipeBehavior.disableVertical.isAvailable()) swipeBehavior.disableVertical();
    }
    initData.restore();
    applyThemeAppearance(detectInitialTheme());
    if (miniApp.ready.isAvailable()) miniApp.ready();
  } catch {
    applyThemeAppearance(detectInitialTheme());
  }
}

export function useTelegramBackButton(visible: boolean, onBack: () => void) {
  useEffect(() => {
    if (!isTMA() || !backButton.isMounted()) return;

    if (!visible) {
      if (backButton.hide.isAvailable()) backButton.hide();
      return;
    }

    if (backButton.show.isAvailable()) backButton.show();
    if (backButton.onClick.isAvailable()) {
      const off = backButton.onClick(onBack);
      return () => {
        off();
        if (backButton.hide.isAvailable()) backButton.hide();
      };
    }
    return undefined;
  }, [visible, onBack]);
}

function hapticsAllowed(): boolean {
  try {
    return localStorage.getItem("stem_haptics") !== "0";
  } catch {
    return true;
  }
}

function notify(type: "success" | "error" | "warning") {
  if (hapticsAllowed() && hapticFeedback.notificationOccurred.isAvailable()) {
    hapticFeedback.notificationOccurred(type);
  }
}

function safeInitDataUser() {
  try {
    return initData.user();
  } catch {
    return undefined;
  }
}

export function useTelegram() {
  return {
    isTelegram: isTMA(),
    user: safeInitDataUser(),
    hapticSuccess: () => notify("success"),
    hapticError: () => notify("error"),
    hapticTap: () => {
      if (hapticsAllowed() && hapticFeedback.impactOccurred.isAvailable()) {
        hapticFeedback.impactOccurred("light");
      }
    },
  };
}
