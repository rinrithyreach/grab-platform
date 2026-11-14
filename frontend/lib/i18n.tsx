"use client";

import { en, km, type MessageKey } from "./messages";
import { useSettings, type Lang } from "./settings";

export type { MessageKey } from "./messages";
type Vars = Record<string, string | number>;

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, km };

function format(text: string, vars?: Vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

function makeTranslator(lang: Lang) {
  return {
    lang,
    t: (key: MessageKey, vars?: Vars) => format(DICTS[lang][key] ?? en[key], vars),
    /** Choose between an English value and an optional Khmer value from data. */
    pick: (english: string, khmer?: string) => (lang === "km" && khmer ? khmer : english),
    dateLocale: lang === "km" ? "km-KH" : "en-US",
  };
}
// Built once per language so `t` is a stable reference (safe in hook dependency lists).
const TRANSLATORS = { en: makeTranslator("en"), km: makeTranslator("km") };

/** const { t, lang, pick } = useT();  t("cart.title"), t("store.min", { n: 25 }) */
export function useT() {
  const { lang } = useSettings();
  return TRANSLATORS[lang] ?? TRANSLATORS.en;
}

/** Lets Server Components show translated text: <T k="food.title" /> */
export function T({ k, vars }: { k: MessageKey; vars?: Vars }) {
  const { t } = useT();
  return <>{t(k, vars)}</>;
}
