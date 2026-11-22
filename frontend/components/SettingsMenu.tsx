"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { updateSettings, useSettings } from "@/lib/settings";
import Icon, { type IconName } from "./Icon";

/** A label on the left and a two-option switch on the right. */
function Switch<V extends string>({ label, value, options, onChange }: {
  label: string;
  value: V;
  options: { value: V; label: string; icon?: IconName }[];
  onChange: (v: V) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={id} className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-labelledby={id} className="flex rounded-full bg-background p-0.5">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                active ? "bg-brand text-white shadow-sm dark:text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LanguagePicker() {
  const { t } = useT();
  const { lang } = useSettings();
  return (
    <Switch
      label={t("settings.language")}
      value={lang}
      options={[{ value: "en", label: "EN" }, { value: "km", label: "ខ្មែរ" }]}
      onChange={(lang) => updateSettings({ lang })}
    />
  );
}

export function ThemePicker() {
  const { t } = useT();
  const { theme } = useSettings();
  return (
    <Switch
      label={t("settings.theme")}
      value={theme}
      options={[
        { value: "light", label: t("settings.light"), icon: "sun" },
        { value: "dark", label: t("settings.dark"), icon: "moon" },
      ]}
      onChange={(theme) => updateSettings({ theme })}
    />
  );
}

/** Settings button in the navbar: quick language and theme switches. */
export default function SettingsMenu() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        aria-label={t("settings.title")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-10 w-10 place-items-center rounded-full text-lg transition-colors hover:bg-brand-soft ${open ? "bg-brand-soft text-brand" : ""}`}
      >
        <Icon name="settings" />
      </button>
      {open && (
        // Phones: span the screen under the navbar. Larger screens: drop down from the button.
        <div
          role="dialog"
          aria-label={t("settings.title")}
          className="card fixed inset-x-4 top-[4.5rem] z-40 space-y-3 p-3.5 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
        >
          <LanguagePicker />
          <ThemePicker />
        </div>
      )}
    </div>
  );
}
