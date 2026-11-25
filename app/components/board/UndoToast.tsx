import { useEffect } from "react";
import type { MoveFields } from "~/domain/rules";

export interface ToastState {
  key: number;
  message: string;
  id: string;
  previous: MoveFields;
}

interface UndoToastProps {
  toast: ToastState;
  onUndo: (toast: ToastState) => void;
  onDismiss: () => void;
}

const TIMEOUT_MS = 6000;

export function UndoToast({ toast, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [toast.key, onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-[10px] bg-ink px-3.5 py-2.5 text-[13.5px] text-bg shadow-2xl"
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => onUndo(toast)}
        className="rounded-lg border border-bg px-2.5 py-1 font-semibold"
      >
        Rückgängig
      </button>
    </div>
  );
}
