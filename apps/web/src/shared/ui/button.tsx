import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-button text-button-text",
  ghost: "text-text ring-1 ring-inset ring-separator",
  positive: "bg-positive/15 text-positive",
  destructive: "bg-destructive/15 text-destructive",
  accent: "bg-accent/15 text-accent",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
