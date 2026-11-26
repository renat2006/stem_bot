import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { broadcastToTeams } from "../../../features/control-shift/index.js";
import { useTelegram } from "../../../shared/lib/index.js";
import { BottomSheet, ToggleSwitch } from "../../../shared/ui/index.js";

const QUICK_MESSAGES = [
  "Через 5 минут открываем магазин — готовьте план покупок.",
  "Осталось 2 минуты — проверьте сборку и подтвердите выбор.",
  "Магазин скоро закрывается. Готовимся к выезду на поле.",
] as const;

interface BroadcastSheetProps {
  open: boolean;
  teams: TeamWithStats[];
  onClose: () => void;
}

export function BroadcastSheet({ open, teams, onClose }: BroadcastSheetProps) {
  const { hapticTap, hapticSuccess, hapticError } = useTelegram();
  const [target, setTarget] = useState<string>("all");
  const [text, setText] = useState("");
  const [silent, setSilent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { report, targetLabel } = await broadcastToTeams({ target, text: trimmed, silent });
      hapticSuccess();
      if (report.attempted === 0) {
        toast.info(`Записано в ленту (${targetLabel}), но в клиентском боте пока нет активных участников`);
      } else {
        const blockedNote = report.blocked > 0 ? ` · заблокировали бота: ${report.blocked}` : "";
        toast.success(`Доставлено ${report.delivered} из ${report.attempted} (${targetLabel})${blockedNote}`);
      }
      setText("");
      onClose();
    } catch (err) {
      hapticError();
      toast.error(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Сообщение в клиентский бот">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-mu">Получатель</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={target === "all"}
              onClick={() => {
                hapticTap();
                setTarget("all");
              }}
              className="atlas-quiet text-xs data-[active=true]:border-ac data-[active=true]:bg-ac data-[active=true]:text-acfg"
              data-active={target === "all"}
            >
              Всем командам
            </button>
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                aria-pressed={target === team.id}
                onClick={() => {
                  hapticTap();
                  setTarget(team.id);
                }}
                className="atlas-quiet text-xs data-[active=true]:border-ac data-[active=true]:bg-ac data-[active=true]:text-acfg"
                data-active={target === team.id}
              >
                {team.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-bold text-mu">Быстрые шаблоны</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MESSAGES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  hapticTap();
                  setText(preset);
                }}
                className="rounded-lg border border-ln bg-sf2 px-2.5 py-1.5 text-left text-xs font-medium text-fg"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-mu">
            <span>Текст сообщения</span>
            <span className="font-mono tabular-nums">{text.trim().length}/1000</span>
          </div>
          <textarea
            rows={4}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Например: Через 5 минут открываем магазин, подготовьте список деталей"
            className="w-full rounded-xl border border-ln bg-sf p-3 text-sm text-fg placeholder:text-mu"
          />
        </label>

        <ToggleSwitch
          checked={silent}
          onChange={setSilent}
          label="Отправить тихо (без звука)"
          description="Участники увидят сообщение в боте без звукового уведомления"
        />

        <button
          type="button"
          disabled={!text.trim() || sending}
          onClick={() => void handleSend()}
          className="atlas-primary"
        >
          <Send className="h-4 w-4" />
          <span>{sending ? "Отправляем…" : "Отправить в клиентский бот"}</span>
        </button>
      </div>
    </BottomSheet>
  );
}
