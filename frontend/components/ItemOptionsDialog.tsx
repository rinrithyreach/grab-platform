"use client";

/**
 * "Customise your dish" pop-up: size, spice level, extras, quantity.
 * Uses the browser's <dialog> element, which handles Escape, focus and the dim backdrop.
 * Keeps the photo beside the options on desktop and above them on phones.
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
      aria-describedby={`opt-description-${item.id}`}
      className="item-dialog food-item-dialog"
    >
      <button type="button" onClick={onClose} aria-label={t("common.close")} className="food-item-close"><Icon name="close" /></button>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (!closed) onAdd(selected, qty); }} className="food-item-form">
        <div className={`food-item-hero ${imageUrl ? "has-photo" : ""}`}>
          {/* Keep the existing local restaurant photo. Absolute sizing prevents the image from pushing the details out of view. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {imageUrl ? <img src={imageUrl} alt={pick(item.name, item.km?.name)} /> : <span className="food-item-emoji" aria-hidden>{item.emoji}</span>}
          <span className="food-item-brand"><Icon name="food" />GrabFood</span>
          {storeName && <div className="food-item-store"><span>{pick("FROM THE RESTAURANT", "ពីហាងអាហារ")}</span><strong><Icon name="store" />{storeName}</strong></div>}
        </div>
        <div className="food-item-panel">
          <div className="food-item-scroll">
            <header className="food-item-intro">
              <p className="food-item-eyebrow">{pick("On the menu", "មុខម្ហូប")}</p>
              <h2 id={`opt-title-${item.id}`}>{pick(item.name, item.km?.name)}</h2>
              <div className="food-item-price"><strong>{money(unitPrice(item, selected))}</strong><span>{pick("per item", "ក្នុងមួយមុខ")}</span>{item.popular && <span className="food-item-popular"><Icon name="star" />{pick("Popular", "ពេញនិយម")}</span>}</div>
              <p id={`opt-description-${item.id}`} className="food-item-description">{pick(item.description, item.km?.description)}</p>
              {closed && <p role="status" className="food-item-closed"><Icon name="clock" />{t("hours.closed")}</p>}
            </header>
            {groups.length > 0 && <section className="food-item-options" aria-labelledby={`opt-customize-${item.id}`}>
              <div className="food-item-options-heading"><h3 id={`opt-customize-${item.id}`}>{pick("Make it yours", "ជ្រើសរើសតាមចំណូលចិត្ត")}</h3><p>{pick("Choose your favorite options below.", "ជ្រើសរើសជម្រើសដែលអ្នកចូលចិត្តខាងក្រោម។")}</p></div>
              {groups.map((g) => (
                <fieldset key={g.id} className="food-item-option-group">
                  <legend><span>{pick(g.name, g.km)}</span><span className={`food-item-option-hint ${g.type === "single" && g.required ? "is-required" : ""}`}>{t(g.type === "single" && g.required ? "options.pickOne" : "options.optional")}</span></legend>
                  <div className={`food-item-choices ${g.type === "single" ? "is-single" : ""}`}>
                    {g.choices.map((c) => {
                      const key = `${g.id}:${c.id}`;
                      return (
                        <label key={c.id} className={`food-item-choice ${has(key) ? "is-selected" : ""}`}>
                          <input
                            type={g.type === "single" ? "radio" : "checkbox"}
                            name={`${item.id}-${g.id}`}
                            checked={has(key)}
                            onChange={() => choose(g.id, c.id, g.type === "single")}
                          />
                          <span>{pick(c.name, c.km)}</span>
                          {c.price > 0 && <small>+{money(c.price)}</small>}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </section>}
          </div>

          <div className="food-item-footer">
            <div className="food-quantity" role="group" aria-label={pick("Quantity", "ចំនួន")}>
              <button type="button" disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={t("store.decrease")}>−</button>
              <output aria-live="polite">{qty}</output>
              <button type="button" disabled={qty >= 50} onClick={() => setQty(q => Math.min(50, q + 1))} aria-label={t("store.increase")}>+</button>
            </div>
            <button type="submit" className="food-add-button" disabled={closed}><Icon name="bag" /><span>{closed ? t("hours.closed") : t("partner.add")}</span><strong>{money(price)}</strong></button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
