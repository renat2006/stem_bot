import { useEffect } from "react";
import {
  hapticFeedback,
  init,
  initData,
  isTMA,
  miniApp,
  retrieveRawInitData,
  swipeBehavior,
  viewport,
} from "@tma.js/sdk-react";

let initialized = false;

export function initTelegramSdk() {
  if (initialized || typeof window === "undefined") return;
  if (!isTMA()) return;

  try {
    init();
    if (miniApp.mount.isAvailable()) {
      miniApp.mount();
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

  let rawInitData = "";
  try {
    rawInitData = retrieveRawInitData() ?? "";
  } catch {
    rawInitData = "";
  }

  return {
    isTelegram: typeof window !== "undefined" && isTMA(),
    user: initData.user(),
    initData: rawInitData,
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
