"use client";

import { dismissToast, useToasts } from "@/lib/toast";

const TONE = {
  success: "bg-brand text-white dark:text-background",
  error: "bg-red-600 text-white",
  info: "bg-foreground text-background",
};

export default function Toaster() {
  const toasts = useToasts();
  return (
    // role="status" makes screen readers announce new messages politely.
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`toast-in pointer-events-auto max-w-sm rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg ${TONE[t.tone]}`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
