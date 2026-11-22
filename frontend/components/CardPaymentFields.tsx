"use client";

import { useState } from "react";
import { cardBrand, digitsOnly, formatCardNumber, formatExpiry, validateCard, type CardBrand, type CardError, type CardField, type CardInput } from "@/lib/card";
import { useT } from "@/lib/i18n";

export function VisaLogo({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Visa">
    <rect width="48" height="30" rx="5" fill="#fff" stroke="#d8dde3" />
    <text x="24" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="13" fontStyle="italic" fontWeight="900" fill="#1a1f71" letterSpacing=".5">VISA</text>
  </svg>;
}

export function MastercardLogo({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Mastercard">
    <rect width="48" height="30" rx="5" fill="#fff" stroke="#d8dde3" />
    <circle cx="19.5" cy="15" r="8" fill="#eb001b" />
    <circle cx="28.5" cy="15" r="8" fill="#f79e1b" />
    <path d="M24 8.4a8 8 0 0 1 0 13.2 8 8 0 0 1 0-13.2Z" fill="#ff5f00" />
  </svg>;
}

const BrandLogo = ({ brand, className }: { brand: CardBrand; className?: string }) =>
  brand === "visa" ? <VisaLogo className={className} /> : <MastercardLogo className={className} />;

/**
 * Card number, name, expiry and CVC for Visa / Mastercard. Shown when the customer
 * picks "Card" at checkout. Errors appear after a field is left, or for every field
 * once `showAllErrors` is set (after pressing Place order).
 */
export default function CardPaymentFields({ value, onChange, showAllErrors = false, idPrefix = "card" }: {
  value: CardInput;
  onChange: (card: CardInput) => void;
  showAllErrors?: boolean;
  idPrefix?: string;
}) {
  const { pick } = useT();
  const [touched, setTouched] = useState<Partial<Record<CardField, boolean>>>({});
  const errors = validateCard(value);
  const brand = cardBrand(value.number);
  const id = (field: CardField) => `${idPrefix}-${field}`;
  const shown = (field: CardField) => (showAllErrors || touched[field]) ? errors[field] : undefined;
  const set = (field: CardField, next: string) => onChange({ ...value, [field]: next });
  const leave = (field: CardField) => () => { if (value[field]) setTouched((s) => ({ ...s, [field]: true })); };

  const messages: Record<CardField, Partial<Record<CardError, string>>> = {
    number: {
      required: pick("Enter your card number.", "សូមបញ្ចូលលេខកាត។"),
      brand: pick("We accept Visa and Mastercard only.", "យើងទទួលតែ Visa និង Mastercard ប៉ុណ្ណោះ។"),
      invalid: pick("Check your card number — it doesn't look right.", "សូមពិនិត្យលេខកាតម្ដងទៀត។"),
    },
    name: {
      required: pick("Enter the name on the card.", "សូមបញ្ចូលឈ្មោះលើកាត។"),
      invalid: pick("Use letters only, as printed on the card.", "សូមប្រើតែអក្សរ ដូចនៅលើកាត។"),
    },
    expiry: {
      required: pick("Enter the expiry date.", "សូមបញ្ចូលថ្ងៃផុតកំណត់។"),
      invalid: pick("Use MM/YY, for example 08/28.", "សូមប្រើ MM/YY ឧ. 08/28។"),
      expired: pick("This card has expired.", "កាតនេះផុតកំណត់ហើយ។"),
    },
    cvc: {
      required: pick("Enter the 3-digit CVC.", "សូមបញ្ចូល CVC ៣ ខ្ទង់។"),
      invalid: pick("CVC is the 3 digits on the back.", "CVC គឺលេខ ៣ ខ្ទង់នៅខាងក្រោយកាត។"),
    },
  };

  const field = (name: CardField) => {
    const error = shown(name);
    return {
      id: id(name),
      "aria-invalid": !!error,
      "aria-describedby": error ? `${id(name)}-error` : undefined,
      className: `input ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`,
      onBlur: leave(name),
    };
  };
  const errorText = (name: CardField) => {
    const error = shown(name);
    return error ? <p id={`${id(name)}-error`} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{messages[name][error]}</p> : null;
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
      <legend className="sr-only">{pick("Card details", "ព័ត៌មានកាត")}</legend>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{pick("Card details", "ព័ត៌មានកាត")}</span>
        {/* Accepted cards; the one being typed lights up. */}
        <span className="flex gap-1.5">
          <VisaLogo className={`h-6 w-auto transition-opacity ${brand && brand !== "visa" ? "opacity-30" : ""}`} />
          <MastercardLogo className={`h-6 w-auto transition-opacity ${brand && brand !== "mastercard" ? "opacity-30" : ""}`} />
        </span>
      </div>

      <div>
        <label htmlFor={id("number")} className="mb-1 block text-xs font-semibold text-muted">{pick("Card number", "លេខកាត")}</label>
        <div className="relative">
          <input
            {...field("number")} className={`${field("number").className} pr-16 tabular-nums tracking-wider`}
            inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" maxLength={23}
            value={value.number} onChange={(e) => set("number", formatCardNumber(e.target.value))}
          />
          {brand && <BrandLogo brand={brand} className="pointer-events-none absolute right-3 top-1/2 h-6 w-auto -translate-y-1/2" />}
        </div>
        {errorText("number")}
      </div>

      <div>
        <label htmlFor={id("name")} className="mb-1 block text-xs font-semibold text-muted">{pick("Name on card", "ឈ្មោះលើកាត")}</label>
        <input
          {...field("name")} className={`${field("name").className} uppercase`}
          autoComplete="cc-name" autoCapitalize="characters" spellCheck={false} placeholder="SOK DARA" maxLength={60}
          value={value.name} onChange={(e) => set("name", e.target.value)}
        />
        {errorText("name")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("expiry")} className="mb-1 block text-xs font-semibold text-muted">{pick("Expiry", "ផុតកំណត់")}</label>
          <input
            {...field("expiry")} className={`${field("expiry").className} tabular-nums`}
            inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5}
            value={value.expiry}
            onChange={(e) => {
              // Let backspace remove the "/" naturally.
              const raw = e.target.value;
              set("expiry", raw.length < value.expiry.length && value.expiry.endsWith("/") ? digitsOnly(raw).slice(0, 1) : formatExpiry(raw));
            }}
          />
          {errorText("expiry")}
        </div>
        <div>
          <label htmlFor={id("cvc")} className="mb-1 block text-xs font-semibold text-muted">CVC</label>
          <input
            {...field("cvc")} className={`${field("cvc").className} tabular-nums`}
            inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={3}
            value={value.cvc} onChange={(e) => set("cvc", digitsOnly(e.target.value).slice(0, 3))}
          />
          {errorText("cvc")}
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted">
        <span aria-hidden>🔒</span>
        {pick("Demo checkout: card details are only checked on this device. They are never saved, sent or charged.", "ការបង់ប្រាក់សាកល្បង៖ ព័ត៌មានកាតត្រូវបានពិនិត្យតែលើឧបករណ៍នេះ។ មិនត្រូវបានរក្សាទុក ផ្ញើ ឬកាត់លុយទេ។")}
      </p>
    </fieldset>
  );
}
