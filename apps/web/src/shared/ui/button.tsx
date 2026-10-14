import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-ac text-acfg",
  ghost: "bg-sf text-fg border border-ln",
  positive: "bg-pos/15 text-pos border border-pos/30",
  destructive: "bg-neg/15 text-neg border border-neg/30",
  accent: "bg-ac/15 text-ac border border-ac/30",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
