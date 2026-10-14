import { useEffect } from "react";

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      username?: string;
    };
  };
  ready: () => void;
  expand: () => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function useTelegram() {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, [tg]);

  return {
    tg,
    user: tg?.initDataUnsafe?.user,
    initData: tg?.initData ?? "",
    hapticSuccess: () => tg?.HapticFeedback?.notificationOccurred("success"),
    hapticTap: () => tg?.HapticFeedback?.impactOccurred("light"),
  };
}
