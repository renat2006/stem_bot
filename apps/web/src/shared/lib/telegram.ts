import {
  hapticFeedback,
  init,
  initData,
  isTMA,
  miniApp,
  retrieveRawInitData,
  swipeBehavior,
  themeParams,
  viewport,
} from "@tma.js/sdk-react";
import { useEffect } from "react";

let initialized = false;

export function getRawInitData(): string {
  if (typeof window === "undefined") return "";
  try {
    return retrieveRawInitData() ?? "";
  } catch {
    return "";
  }
}

export function initTelegramSdk() {
  if (initialized || typeof window === "undefined") return;
  if (!isTMA()) return;

  try {
    init();
    if (themeParams.mount.isAvailable()) {
      themeParams.mount();
      if (themeParams.bindCssVars.isAvailable()) {
        themeParams.bindCssVars();
      }
    }
    if (miniApp.mount.isAvailable()) {
      miniApp.mount();
      if (miniApp.bindCssVars.isAvailable()) {
        miniApp.bindCssVars();
      }
      miniApp.ready();
    }
    if (viewport.mount.isAvailable()) {
      void viewport.mount().then(() => {
        if (viewport.expand.isAvailable()) viewport.expand();
        if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
      });
    }
    if (swipeBehavior.mount.isAvailable()) {
      swipeBehavior.mount();
      if (swipeBehavior.disableVertical.isAvailable()) {
        swipeBehavior.disableVertical();
      }
    }
    initData.restore();
    initialized = true;
  } catch {
    initialized = false;
  }
}

export function useTelegram() {
  useEffect(() => {
    initTelegramSdk();
  }, []);

  return {
    isTelegram: typeof window !== "undefined" && isTMA(),
    user: initData.user(),
    initData: getRawInitData(),
    hapticSuccess: () => {
      if (hapticFeedback.notificationOccurred.isAvailable()) {
        hapticFeedback.notificationOccurred("success");
      }
    },
    hapticTap: () => {
      if (hapticFeedback.impactOccurred.isAvailable()) {
        hapticFeedback.impactOccurred("light");
      }
    },
    requestFullscreen: () => {
      if (viewport.requestFullscreen.isAvailable()) {
        void viewport.requestFullscreen();
      }
    },
  };
}
