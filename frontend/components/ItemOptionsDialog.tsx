"use client";

/**
 * "Customise your dish" pop-up: size, spice level, extras, quantity.
 * Uses the browser's <dialog> element, which handles Escape, focus and the dim backdrop.
 * Opens as a bottom sheet on phones and a centred box on larger screens.
 */
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/brand";
import type { MenuItem } from "@/lib/catalog";
import { useT } from "@/lib/i18n";
import { defaultOptions, unitPrice } from "@/lib/pricing";
import Icon from "./Icon";

interface Props {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
  onAdd: (options: string[], qty: number) => void;
  storeName?: string;
  imageUrl?: string;
  closed?: boolean;
}

export default function ItemOptionsDialog({ item, open, onClose, onAdd, storeName, imageUrl, closed = false }: Props) {
  const { t, pick } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>(() => defaultOptions(item));
  const [qty, setQty] = useState(1);

  // Open/close the native dialog when `open` changes.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const groups = item.options ?? [];
  const has = (key: string) => selected.includes(key);
  function choose(groupId: string, choiceId: string, single: boolean) {
    const key = `${groupId}:${choiceId}`;
    setSelected((s) => single
      ? [...s.filter((k) => !k.startsWith(`${groupId}:`)), key]
      : s.includes(key) ? s.filter((k) => k !== key) : [...s, key]);
  }
  const price = unitPrice(item, selected) * qty;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} // click on the backdrop
      aria-labelledby={`opt-title-${item.id}`}
      className="item-dialog food-item-dialog"
    >
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (!closed) onAdd(selected, qty); }} className="food-item-form">
        <div className="food-item-scroll">
          <div className={`food-item-hero ${imageUrl ? "has-photo" : ""}`}>
            {/* The sample menu's existing local food photo, where available. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {imageUrl ? <img src={imageUrl} alt={pick(item.name, item.km?.name)} /> : <span className="food-item-emoji" aria-hidden>{item.emoji}</span>}
            {storeName && <span className="food-item-store"><Icon name="food" />{storeName}</span>}
            <button type="button" onClick={onClose} aria-label={t("common.close")} className="food-item-close"><Icon name="close" /></button>
          </div>
          <div className="food-item-intro"><div><h2 id={`opt-title-${item.id}`}>{pick(item.name, item.km?.name)}</h2><strong>{money(unitPrice(item, selected))}</strong></div><p>{pick(item.description, item.km?.description)}</p>{closed && <p role="status" className="text-brand">{t("hours.closed")}</p>}</div>
          <div className="food-item-options space-y-5">
          {groups.map((g) => (
            <fieldset key={g.id}>
              <legend className="mb-2 flex w-full items-center justify-between font-semibold">
                {pick(g.name, g.km)}
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">
                  {t(g.type === "single" && g.required ? "options.pickOne" : "options.optional")}
                </span>
              </legend>
              <div className="space-y-1.5">
                {g.choices.map((c) => {
                  const key = `${g.id}:${c.id}`;
                  return (
                    <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${has(key) ? "border-brand bg-brand-soft" : "border-border"}`}>
                      <input
                        type={g.type === "single" ? "radio" : "checkbox"}
                        name={`${item.id}-${g.id}`}
                        checked={has(key)}
                        onChange={() => choose(g.id, c.id, g.type === "single")}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      <span className="flex-1">{pick(c.name, c.km)}</span>
                      {c.price > 0 && <span className="text-sm text-muted">+{money(c.price)}</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          </div>
        </div>

        <div className="food-item-footer">
          <div className="food-quantity" role="group" aria-label={pick("Quantity", "ចំនួន")}>
            <button type="button" disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={t("store.decrease")}>−</button>
            <output aria-live="polite">{qty}</output>
            <button type="button" disabled={qty >= 50} onClick={() => setQty(q => Math.min(50, q + 1))} aria-label={t("store.increase")}>+</button>
          </div>
          <button type="submit" className="food-add-button" disabled={closed}><Icon name="bag" /><span>{closed ? t("hours.closed") : t("partner.add")}</span><strong>{money(price)}</strong></button>
        </div>
      </form>
    </dialog>
  );
}
