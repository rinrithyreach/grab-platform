"use client";

import { useAdminT } from "@/lib/admin-i18n";
import { updateSettings, useSettings } from "@/lib/settings";
import AdminIcon from "./AdminIcon";

/** Two-option pill switch (e.g. EN / ខ្មែរ). */
export function Segmented<V extends string>({ label, value, options, onChange, className = "" }: {
  label: string; value: V; options: { value: V; label: string; icon?: string }[]; onChange: (v: V) => void; className?: string;
}) {
  return <div role="radiogroup" aria-label={label} className={`admin-segmented ${className}`}>{options.map(o => <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>{o.icon && <AdminIcon name={o.icon} size={15} />}{o.label}</button>)}</div>;
}

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { a } = useAdminT();
  const { lang } = useSettings();
  return <Segmented className={compact ? "compact" : ""} label={a("Language")} value={lang}
    options={[{ value: "en", label: compact ? "EN" : "English" }, { value: "km", label: "ខ្មែរ" }]}
    onChange={lang => updateSettings({ lang })} />;
}

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { a } = useAdminT();
  const { theme } = useSettings();
  if (compact) {
    // One button that flips between light and dark; the icon shows the current look.
    const next = theme === "dark" ? "light" : "dark";
    const label = a(next === "dark" ? "Switch to dark mode" : "Switch to light mode");
    return <button type="button" className="admin-icon-button" onClick={() => updateSettings({ theme: next })} title={label} aria-label={label}><AdminIcon name={theme === "dark" ? "moon" : "sun"} /></button>;
  }
  return <Segmented label={a("Theme")} value={theme}
    options={[{ value: "light", label: a("Light"), icon: "sun" }, { value: "dark", label: a("Dark"), icon: "moon" }]}
    onChange={theme => updateSettings({ theme })} />;
}
