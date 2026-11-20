"use client";

import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { useState } from "react";
import { useWallet, type WalletTxn } from "@/lib/wallet";
import { useAuth } from "@/lib/auth";
import BackButton from "@/components/BackButton";
import LoginRequired from "@/components/LoginRequired";
import TopUpDialog from "@/components/TopUpDialog";

const AMOUNTS = [1, 5, 10, 20, 50];

export default function WalletPage() {
  const { t, dateLocale } = useT();
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const { balance, txns, hasWallet } = useWallet(userId);
  // The amount being topped up (opens the payment pop-up), or null.
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);

  const describe = (x: WalletTxn) =>
    x.kind === "topup" ? t("wallet.topUpTxn") : x.description;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/profile" />
      <h1 className="text-3xl font-bold">{t("wallet.name")}</h1>
      <p className="mt-1 text-muted">{t("wallet.subtitle")}</p>

      {/* Only logged-in users have a wallet. Wait for a saved login to be restored before deciding. */}
      {!ready ? (
        <div className="mt-6 h-48 animate-pulse rounded-2xl bg-border" aria-busy />
      ) : !hasWallet ? (
        <LoginRequired what="loginRequired.useWallet" />
      ) : (<>

      {/* Balance card */}
      <section className="mt-6 rounded-2xl bg-gradient-to-br from-brand to-brand-strong p-6 text-white shadow-lg dark:text-background">
        <p className="text-sm opacity-90">{t("wallet.balance")}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{money(balance)}</p>
        <p className="mt-4 text-sm font-semibold">{t("wallet.topUp")}</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setTopUpAmount(a)}
              aria-label={t("topup.title", { amount: money(a) })}
              aria-haspopup="dialog"
              className="rounded-xl bg-white/15 py-2.5 font-bold transition-colors hover:bg-white/25"
            >
              +${a}
            </button>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="card mt-4 p-5">
        <h2 className="text-lg font-bold">{t("wallet.history")}</h2>
        {txns.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("wallet.empty")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {txns.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft" aria-hidden>
                  {x.kind === "payment" ? "🛍️" : "➕"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{describe(x)}</p>
                  <p className="text-xs text-muted">
                    {new Date(x.createdAt).toLocaleString(dateLocale)}
                    {x.method && <> · {t("topup.via", { method: x.method })}</>}
                  </p>
                </div>
                <p className={`shrink-0 font-semibold ${x.amount >= 0 ? "text-brand" : ""}`}>
                  {x.amount >= 0 ? "+" : "−"}{money(Math.abs(x.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {topUpAmount !== null && <TopUpDialog amount={topUpAmount} onClose={() => setTopUpAmount(null)} />}
      </>)}
    </div>
  );
}
