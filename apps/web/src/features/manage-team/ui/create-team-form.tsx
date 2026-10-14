import { useState } from "react";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { createTeam } from "../api/manage-team-api.js";

export function CreateTeamForm({ run }: { run: RunAction }) {
  const [name, setName] = useState("");
  const valid = name.trim().length >= 2;

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        void run(async () => {
          const result = await createTeam(name.trim());
          setName("");
          return result;
        });
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="Название новой команды"
        aria-label="Название новой команды"
        className="h-11 min-w-0 flex-1 rounded-xl border border-ln bg-sf px-3.5 text-sm text-fg placeholder:text-mu focus:border-ac focus:outline-none"
      />
      <Button type="submit" disabled={!valid}>
        Создать
      </Button>
    </form>
  );
}
