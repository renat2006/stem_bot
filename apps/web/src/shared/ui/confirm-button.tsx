import { type ReactNode, useEffect, useState } from "react";
import { Button } from "./button.js";

interface ConfirmButtonProps {
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "destructive" | "accent" | "primary";
  className?: string;
}

export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timeout = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timeout);
  }, [armed]);

  return (
    <Button
      variant={armed ? "destructive" : variant}
      className={className}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
