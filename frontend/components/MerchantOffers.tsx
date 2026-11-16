"use client";

import { useEffect, useState } from "react";
import type { MerchantOffer, MerchantServiceKind } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import MerchantOfferCard from "./MerchantOfferCard";

export default function MerchantOffers({ service }: { service?: MerchantServiceKind }) {
  const { api } = useAuth();
  const { t } = useT();
  const [offers, setOffers] = useState<MerchantOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api.merchantOffers(service, 1, ctrl.signal).then((rows) => {
      setOffers(rows); setMore(rows.length === 24); setPage(1); setError(false); setLoading(false);
    }).catch(() => { if (!ctrl.signal.aborted) { setError(true); setLoading(false); } });
    return () => ctrl.abort();
  }, [api, service, retry]);

  async function loadMore() {
    setLoading(true); setError(false);
    try {
      const rows = await api.merchantOffers(service, page + 1);
      setOffers((previous) => [...previous, ...rows.filter((row) => !previous.some((item) => item.id === row.id))]);
      setMore(rows.length === 24); setPage((p) => p + 1);
    } catch { setError(true); }
    finally { setLoading(false); }
  }

  return <section className="mt-12" aria-label={t("merchant.partners")}>
    <h2 className="text-2xl font-bold">{t("merchant.partners")}</h2>
    <p className="mt-1 text-sm text-muted">{t("merchant.partnersIntro")}</p>
    {offers.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{offers.map((offer) => <MerchantOfferCard key={offer.id} offer={offer} />)}</div>}
    {loading && <p role="status" className="mt-5 text-sm text-muted">{t("merchant.loading")}</p>}
    {error && <div className="card mt-5 flex flex-wrap items-center justify-between gap-3 p-4"><p role="alert" className="text-sm text-muted">{t("merchant.unavailable")}</p><button className="btn-outline text-sm" disabled={loading} onClick={() => { if (offers.length) void loadMore(); else { setLoading(true); setRetry((n) => n + 1); } }}>{t("merchant.retry")}</button></div>}
    {!loading && !error && !offers.length && <p className="card mt-5 p-5 text-sm text-muted">{t("merchant.noOffers")}</p>}
    {more && !error && <button className="btn-outline mt-5" disabled={loading} onClick={loadMore}>{t("merchant.loadMore")}</button>}
  </section>;
}
