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
import { useEffect, useState } from "react";

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
    const bgHex = mode === "dark" ? "#0f1214" : "#f4f5f6";
    const headerHex = mode === "dark" ? "#14181b" : "#ffffff";
    const tgBg = themeParams.secondaryBgColor() ?? bgHex;
    const tgHeader = themeParams.headerBgColor() ?? themeParams.bgColor() ?? headerHex;
    if (miniApp.setHeaderColor.isAvailable()) miniApp.setHeaderColor(tgHeader);
    if (miniApp.setBgColor.isAvailable()) miniApp.setBgColor(tgBg);
    if (miniApp.setBottomBarColor.isAvailable()) miniApp.setBottomBarColor(tgBg);
  }
}

export function detectInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
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
    void viewport.mount().then(() => {
      if (viewport.expand.isAvailable()) viewport.expand();
      if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
    });
  }
  if (swipeBehavior.mount.isAvailable()) {
    swipeBehavior.mount();
    if (swipeBehavior.disableVertical.isAvailable()) swipeBehavior.disableVertical();
  }
  initData.restore();
  applyThemeAppearance(themeParams.isDark() ? "dark" : "light");
  if (miniApp.ready.isAvailable()) miniApp.ready();
}

export function useTelegramTheme() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => detectInitialTheme());
  const [manualOverride, setManualOverride] = useState<"light" | "dark" | null>(null);

  const effectiveMode = manualOverride ?? themeMode;

  useEffect(() => {
    applyThemeAppearance(effectiveMode);
  }, [effectiveMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isTMA() && themeParams.isMounted()) {
      const unsub = themeParams.isDark.sub((isDark) => {
        setThemeMode(isDark ? "dark" : "light");
      });
      return () => unsub();
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      setThemeMode(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = () => {
    setManualOverride((prev) => {
      const current = prev ?? themeMode;
      return current === "light" ? "dark" : "light";
    });
  };

  return {
    themeMode: effectiveMode,
    toggleTheme,
  };
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

function notify(type: "success" | "error" | "warning") {
  if (hapticFeedback.notificationOccurred.isAvailable()) hapticFeedback.notificationOccurred(type);
}

export function useTelegram() {
  return {
    isTelegram: isTMA(),
    user: initData.user(),
    hapticSuccess: () => notify("success"),
    hapticError: () => notify("error"),
    hapticTap: () => {
      if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred("light");
    },
  };
}
