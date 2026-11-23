"use client";

/**
 * 🔔 in the navbar: unread count, and a panel listing recent notifications
 * (orders, rides, wallet, account) with "mark all as read" and "clear all".
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useNow } from "@/lib/clock";
import { confirmDialog } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import {
  clearNotifications, markAllNotificationsRead, markNotificationRead, removeNotification, setNotifyPref,
  useNotifications, useNotifyPrefs, useUnreadCount, type NotificationKind, type NotifyPrefs,
} from "@/lib/notifications";
import type { MessageKey } from "@/lib/i18n";
import Icon, { type IconName } from "./Icon";

const KIND_ICON: Record<NotificationKind, IconName> = {
  order: "receipt", ride: "car", wallet: "wallet", account: "user", merchant: "store", system: "info",
  product: "bag", wishlist: "heart",
};
const PREFS: { key: keyof NotifyPrefs; label: MessageKey }[] = [
  { key: "newProducts", label: "notify.prefNewProducts" },
  { key: "restock", label: "notify.prefRestock" },
  { key: "wishlist", label: "notify.prefWishlist" },
];

export default function NotificationBell() {
  const { t } = useT();
  const items = useNotifications();
  const unread = useUnreadCount();
  const prefs = useNotifyPrefs();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      // Clicks inside the confirm dialog (rendered elsewhere) must not close the panel.
      const target = e.target as Element;
      if (!ref.current?.contains(target) && !target.closest?.("dialog")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const ago = (time: number) => {
    // The shared clock reads 0 until it starts; treat that as "just now".
    const minutes = now ? Math.floor(Math.max(0, now - time) / 60_000) : 0;
    if (minutes < 1) return t("notify.justNow");
    if (minutes < 60) return t("notify.minutesAgo", { n: minutes });
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? t("notify.hoursAgo", { n: hours }) : t("notify.daysAgo", { n: Math.floor(hours / 24) });
  };

  async function clearAll() {
    if (await confirmDialog({ title: t("notify.clearConfirm"), confirmLabel: t("notify.clear"), cancelLabel: t("dialog.keep"), tone: "danger" })) clearNotifications();
  }

  const label = unread ? t("notify.openUnread", { n: unread }) : t("notify.open");

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative grid h-10 w-10 place-items-center rounded-full hover:bg-brand-soft ${open ? "bg-brand-soft text-brand" : ""}`}
      >
        <Icon name="bell" className={unread ? "bell-ring" : ""} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label={t("notify.title")} className="card notify-panel shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="font-bold">{t("notify.title")}</h2>
            {unread > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-sm font-semibold text-brand hover:underline">{t("notify.markAll")}</button>}
          </div>

          {items.length ? (
            <ul className="notify-list">
              {items.map((n) => {
                const body = (
                  <>
                    <span className={`notify-icon notify-${n.kind}`} aria-hidden><Icon name={KIND_ICON[n.kind]} />{!n.read && <span className="notify-dot" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</span>
                      <span className="block text-sm text-muted">{n.body}</span>
                      <span className="mt-0.5 block text-xs text-muted">{ago(n.createdAt)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id} className={`notify-item ${n.read ? "" : "is-unread"}`}>
                    {n.href
                      ? <Link href={n.href} onClick={() => { markNotificationRead(n.id); setOpen(false); }} className="notify-row">{body}</Link>
                      : <button type="button" onClick={() => markNotificationRead(n.id)} className="notify-row text-left">{body}</button>}
                    <button type="button" onClick={() => removeNotification(n.id)} aria-label={t("notify.remove")} className="notify-remove"><Icon name="close" className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden><Icon name="bell" /></span>
              <p className="mt-3 font-semibold">{t("notify.empty")}</p>
              <p className="mt-1 text-sm text-muted">{t("notify.emptyText")}</p>
            </div>
          )}

          <details className="notify-prefs border-t border-border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-semibold">{t("notify.prefs")}<Icon name="chevron" className="notify-prefs-chevron h-4 w-4 text-muted" /></summary>
            <div className="space-y-2 px-4 pb-3">
              {PREFS.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" role="switch" checked={prefs[p.key]} onChange={(e) => setNotifyPref(p.key, e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                  {t(p.label)}
                </label>
              ))}
            </div>
          </details>
          {items.length > 0 && <div className="flex justify-end border-t border-border px-4 py-3">
            <button type="button" onClick={() => void clearAll()} className="text-sm text-muted hover:text-red-600">{t("notify.clear")}</button>
          </div>}
        </div>
      )}
    </div>
  );
}
