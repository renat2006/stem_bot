import type { RunAction } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { buyCard, buyPerk } from "../api/purchase-api.js";

interface PurchaseButtonProps {
  kind: "card" | "perk";
  teamId: string;
  itemId: string;
  label: string;
  disabled: boolean;
  run: RunAction;
}

export function PurchaseButton({ kind, teamId, itemId, label, disabled, run }: PurchaseButtonProps) {
  const purchase = kind === "card" ? buyCard : buyPerk;
  return (
    <Button className="shrink-0" disabled={disabled} onClick={() => run(() => purchase(teamId, itemId))}>
      {label}
    </Button>
  );
}
