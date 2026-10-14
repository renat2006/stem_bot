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

let initialized = false;

export function getRawInitData(): string {
  try {
    return retrieveRawInitData() ?? "";
  } catch {
    return "";
  }
}

export function initTelegramSdk() {
  if (initialized || !isTMA()) return;
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
  if (miniApp.ready.isAvailable()) miniApp.ready();
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
