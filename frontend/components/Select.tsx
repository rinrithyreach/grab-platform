"use client";

/**
 * Custom dropdown. Native <select> popups are drawn by the browser and can spill
 * past the screen on mobile; this list always stays inside its own box.
 */
import { useEffect, useId, useRef, useState } from "react";

export interface Option<V extends string | number> { value: V; label: string }

interface Props<V extends string | number> {
  value: V;
  options: Option<V>[];
  onChange: (value: V) => void;
  label?: string;
  id?: string;
  className?: string;
}

export default function Select<V extends string | number>({ value, options, onChange, label, id, className = "" }: Props<V>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(v: V) { onChange(v); setOpen(false); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active].value); }
    else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{current?.label}</span>
        <span aria-hidden className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <ul id={listId} role="listbox" className="card absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto p-1 shadow-xl">
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
              className={`cursor-pointer rounded-lg px-3 py-2.5 ${i === active ? "bg-brand-soft" : ""} ${o.value === value ? "font-semibold text-brand" : ""}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
