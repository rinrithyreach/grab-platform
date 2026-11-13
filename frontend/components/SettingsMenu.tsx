"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { updateSettings, useSettings, type Lang, type Theme } from "@/lib/settings";

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "km", label: "ខ្មែរ" },
];
const THEMES: { value: Theme; icon: string }[] = [
  { value: "light", icon: "☀️" },
  { value: "dark", icon: "🌙" },
  { value: "system", icon: "💻" },
];

function Segmented<V extends string>({ label, value, options, onChange }: {
  label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-muted">{label}</legend>
      <div className="flex gap-1 rounded-xl bg-background p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
              value === o.value ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Gear button in the navbar that opens language + theme settings. */
export default function SettingsMenu() {
  const { t } = useT();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={t("settings.title")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-brand-soft"
      >
        ⚙️
      </button>
      {open && (
        // Phones: span the screen under the navbar. Larger screens: drop down from the gear.
        <div className="card fixed inset-x-4 top-[4.5rem] z-40 space-y-4 p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <p className="font-bold">{t("settings.title")}</p>
          <Segmented
            label={t("settings.language")}
            value={settings.lang}
            options={LANGS}
            onChange={(lang) => updateSettings({ lang })}
          />
          <Segmented
            label={t("settings.theme")}
            value={settings.theme}
            options={THEMES.map((th) => ({ value: th.value, label: `${th.icon} ${t(`settings.${th.value}`)}` }))}
            onChange={(theme) => updateSettings({ theme })}
          />
        </div>
      )}
    </div>
  );
}
