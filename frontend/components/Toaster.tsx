"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
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

const GAP = 12;

/** The button/link the user just pressed (pointer or keyboard), if any. */
let lastPress: { el: Element; at: number } | null = null;
function pressedControl(): Element | null {
  if (lastPress && Date.now() - lastPress.at < 1500 && lastPress.el.isConnected) return lastPress.el;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  return active && active !== document.body ? active : null;
}

const overlaps = (a: DOMRect, top: number, height: number) =>
  a.bottom > top && a.top < top + height;

export default function Toaster() {
  const toasts = useToasts();
  const ref = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  // Remember the control that was pressed so a toast it triggers can stay out of its way.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role='button'], input, label");
      if (el) lastPress = { el, at: Date.now() };
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  // When a new toast arrives, check it isn't covering the button that triggered it
  // (e.g. the heart on a product page). If it is, move the stack just below that
  // button, or above it, before the browser paints.
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    if (!toasts.length) { box.style.top = ""; lastId.current = 0; return; }
    const newest = toasts[toasts.length - 1].id;
    if (newest === lastId.current) return; // a toast left; don't make the stack jump
    lastId.current = newest;

    box.style.top = "";
    const anchor = pressedControl()?.getBoundingClientRect();
    const home = box.getBoundingClientRect();
    if (!anchor || anchor.height > 240) return;
    // Horizontal check against the cards themselves, not the (wider) padded container.
    const cards = Array.from(box.children).map((c) => c.getBoundingClientRect());
    const left = Math.min(...cards.map((r) => r.left)), right = Math.max(...cards.map((r) => r.right));
    if (anchor.right <= left || anchor.left >= right || !overlaps(anchor, home.top, home.height)) return;

    const below = anchor.bottom + GAP;
    const above = anchor.top - GAP - home.height;
    if (below + home.height <= window.innerHeight - GAP) box.style.top = `${below}px`;
    else if (above >= GAP) box.style.top = `${above}px`;
  }, [toasts]);

  return (
    // Phones: centred under the header. Desktop (sm+): stacked in the top-right corner.
    <div ref={ref} aria-live="polite" className="app-toaster pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-2 sm:w-113 sm:max-w-full sm:items-end">
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>
  );
}
