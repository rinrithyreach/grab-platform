"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { dismissToast, pauseToast, resumeToast, useToasts, type Toast, type ToastTone } from "@/lib/toast";
import Icon, { type IconName } from "./Icon";

const ICON: Record<ToastTone, IconName> = { success: "check", error: "alert", info: "info", warning: "warning" };

function ToastCard({ toast }: { toast: Toast }) {
  const { t } = useT();
  const { id, tone, title, text, action, duration } = toast;
  const close = () => dismissToast(id);
  return (
    <div
      // Errors interrupt the screen reader; everything else waits politely.
      role={tone === "error" ? "alert" : "status"}
      onPointerEnter={() => pauseToast(id)}
      onPointerLeave={() => resumeToast(id)}
      onFocus={() => pauseToast(id)}
      onBlur={() => resumeToast(id)}
      className={`app-toast app-toast-${tone} toast-in pointer-events-auto`}
    >
      <span className="app-toast-icon" aria-hidden><Icon name={ICON[tone]} /></span>
      <div className="min-w-0 flex-1">
        {title && <p className="app-toast-title">{title}</p>}
        <p className="app-toast-text">{text}</p>
        {action && (
          action.href
            ? <Link href={action.href} onClick={() => { action.onClick?.(); close(); }} className="app-toast-action">{action.label}</Link>
            : <button type="button" onClick={() => { action.onClick?.(); close(); }} className="app-toast-action">{action.label}</button>
        )}
      </div>
      <button type="button" onClick={close} aria-label={t("toast.dismiss")} className="app-toast-close"><Icon name="close" /></button>
      {duration > 0 && <span aria-hidden className="app-toast-timer" style={{ animationDuration: `${duration}ms` }} />}
    </div>
  );
}

export default function Toaster() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" className="app-toaster pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>
  );
}
