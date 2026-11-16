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

interface Props {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
  onAdd: (options: string[], qty: number) => void;
}

export default function ItemOptionsDialog({ item, open, onClose, onAdd }: Props) {
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
      className="item-dialog m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-foreground shadow-2xl sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); onAdd(selected, qty); }} className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start gap-3 border-b border-border p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-soft text-3xl" aria-hidden>{item.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 id={`opt-title-${item.id}`} className="text-lg font-bold leading-snug">{pick(item.name, item.km?.name)}</h2>
            <p className="text-sm text-muted">{pick(item.description, item.km?.description)}</p>
            <p className="mt-1 font-semibold text-brand">{money(item.price)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg hover:bg-brand-soft">✕</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
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

        <div className="flex items-center gap-3 border-t border-border p-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t("store.decrease")} className="grid h-10 w-10 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">−</button>
            <span className="w-6 text-center font-semibold" aria-live="polite">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} aria-label={t("store.increase")} className="grid h-10 w-10 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">+</button>
          </div>
          <button type="submit" className="btn-primary flex-1">{t("options.add", { price: money(price) })}</button>
        </div>
      </form>
    </dialog>
  );
}
