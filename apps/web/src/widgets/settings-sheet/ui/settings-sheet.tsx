import { BookOpen, Monitor, Moon, Sun } from "lucide-react";
import {
  type ColorSchemePreference,
  setColorSchemePreference,
  setContrastPreference,
  setHapticsPreference,
  setReducedMotionPreference,
  usePreferences,
} from "../../../shared/lib/index.js";
import { ModalDialog, ToggleSwitch } from "../../../shared/ui/index.js";

export function SettingsSheet({
  open,
  onClose,
  onOpenOnboarding,
}: {
  open: boolean;
  onClose: () => void;
  onOpenOnboarding?: () => void;
}) {
  const prefs = usePreferences();
  const systemDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const schemes: Array<{ id: ColorSchemePreference; label: string; hint?: string; icon: typeof Sun }> = [
    {
      id: "system",
      label: "Авто",
      hint: systemDark ? "сейчас тёмная" : "сейчас светлая",
      icon: Monitor,
    },
    { id: "light", label: "Светлая", icon: Sun },
    { id: "dark", label: "Тёмная", icon: Moon },
  ];

  return (
    <ModalDialog open={open} onClose={onClose} title="Настройки отображения">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-fg">Комфорт и интерфейс</h3>
          <p className="text-xs text-mu">Настройки сохраняются на этом устройстве</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-mu">Тема оформления</p>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-sf2 p-1">
            {schemes.map((item) => {
              const IconComp = item.icon;
              const active = prefs.colorScheme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setColorSchemePreference(item.id)}
                  className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                    active ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <IconComp className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  {item.hint && <span className="text-[10px] text-mu">{item.hint}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <ToggleSwitch
            checked={prefs.contrast === "high"}
            onChange={(checked) => setContrastPreference(checked ? "high" : "normal")}
            label="Высокая контрастность"
            description="Чёткие границы карточек и усиленная читаемость текста"
          />
          <ToggleSwitch
            checked={prefs.reducedMotion}
            onChange={setReducedMotionPreference}
            label="Уменьшить анимации"
            description="Отключает покачивание стенда и пружинные переходы"
          />
          <ToggleSwitch
            checked={prefs.hapticsEnabled}
            onChange={setHapticsPreference}
            label="Тактильный отклик"
            description="Лёгкая вибрация при установке деталей и покупках"
          />
        </div>

        {onOpenOnboarding && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenOnboarding();
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-ln bg-sf text-sm font-medium text-fg"
          >
            <BookOpen className="h-4 w-4 text-ac" />
            Посмотреть обучение и предысторию
          </button>
        )}
      </div>
    </ModalDialog>
  );
}
