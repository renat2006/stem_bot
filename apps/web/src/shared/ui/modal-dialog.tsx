import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = "";
        onClose();
      }}
      onPointerDown={(e) => {
        const el = dialogRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        pressedOutsideRef.current =
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      }}
      onPointerUp={(e) => {
        const el = dialogRef.current;
        if (!el || !pressedOutsideRef.current) return;
        const r = el.getBoundingClientRect();
        const outside =
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (outside) el.close();
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-[440px] rounded-2xl border border-ln bg-bg p-0 text-fg shadow-xl open:flex open:flex-col"
    >
      <div className="flex items-start justify-between gap-3 border-b border-ln px-4 py-3.5">
        <div className="min-w-0">
          {subtitle && (
            <p className="font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-mu">
              {subtitle}
            </p>
          )}
          <h2 id={titleId} className="text-lg leading-snug font-semibold text-fg">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Закрыть окно"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sf2 text-mu transition hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[78dvh] overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}
