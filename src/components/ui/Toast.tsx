"use client";
/**
 * Toast — lightweight notification system.
 * Wrap the app shell in <ToastProvider>; call useToast().push(...).
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./icons";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const toneConfig: Record<ToastTone, { icon: keyof typeof Icon; classes: string }> = {
  success: { icon: "Check", classes: "border-success/25 text-success" },
  error: { icon: "Alert", classes: "border-danger/30 text-danger" },
  info: { icon: "Info", classes: "border-info/25 text-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:items-end"
      >
        {toasts.map((t) => {
          const cfg = toneConfig[t.tone];
          const Ico = Icon[cfg.icon];
          return (
            <div
              key={t.id}
              className={`animate-message-in pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-2.5 text-[13px] shadow-pop ${cfg.classes}`}
            >
              <Ico size={15} className="mt-0.5 shrink-0" />
              <span className="text-ink">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
