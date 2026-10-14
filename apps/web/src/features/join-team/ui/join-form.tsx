import { useState } from "react";
import { getStartParam, type RunAction } from "../../../shared/lib/index.js";
import { joinTeam } from "../api/join-api.js";

interface JoinFormProps {
  defaultName: string;
  run: RunAction;
  onJoined: () => void;
}

const CODE_LENGTH = 6;

export function JoinForm({ defaultName, run, onJoined }: JoinFormProps) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(() =>
    (getStartParam() ?? new URLSearchParams(window.location.search).get("code") ?? "")
      .toUpperCase()
      .slice(0, CODE_LENGTH),
  );
  const ready = name.trim().length > 0 && code.trim().length >= 4;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        void run(async () => {
          const result = await joinTeam(code.trim(), name.trim());
          onJoined();
          return result;
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-medium text-fg">Как вас зовут</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          placeholder="Имя, которое увидит команда"
          className="h-12 rounded-xl border border-ln bg-sf px-3.5 text-base text-fg focus:border-ac focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-medium text-fg">Код команды</span>
        <input
          value={code}
          maxLength={CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="ABC123"
          className="h-14 rounded-xl border-[1.5px] border-ac bg-sf px-4 text-center font-mono text-2xl font-semibold tracking-[0.25em] uppercase text-fg placeholder:text-mu/50 focus:outline-none"
        />
        <span className="text-xs text-mu">Код выдаёт ведущий. Первый вошедший становится капитаном.</span>
      </label>

      <button
        type="submit"
        disabled={!ready}
        className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:bg-sf2 disabled:text-mu"
      >
        Войти в команду
      </button>
    </form>
  );
}
