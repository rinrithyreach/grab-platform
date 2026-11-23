"use client";

/** "Pay in" USD / KHR choice, each showing the amount the customer will hand over. */
import { formatPaid, CURRENCIES, KHR_PER_USD, riel, type Currency } from "@/lib/currency";
import { useT } from "@/lib/i18n";

export default function CurrencyPicker({ value, onChange, usd, disabled = false, hint, name = "pay-currency" }: {
  value: Currency;
  onChange: (currency: Currency) => void;
  /** The amount in US dollars. */
  usd: number;
  disabled?: boolean;
  /** Shown under the choices instead of the exchange rate (e.g. why it is locked). */
  hint?: string;
  name?: string;
}) {
  const { t } = useT();
  return (
    <fieldset disabled={disabled} className="currency-picker">
      <legend className="label">{t("currency.payIn")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {CURRENCIES.map((currency) => (
          <label key={currency} className={`currency-option ${value === currency ? "is-selected" : ""}`}>
            <input type="radio" name={name} value={currency} checked={value === currency} onChange={() => onChange(currency)} className="sr-only" />
            <span className="currency-code">{currency}</span>
            <span className="currency-amount">{formatPaid(usd, currency)}</span>
            <span className="currency-name">{t(currency === "USD" ? "currency.USD" : "currency.KHR")}</span>
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">{hint ?? t("currency.rate", { rate: riel(KHR_PER_USD) })}</p>
    </fieldset>
  );
}
