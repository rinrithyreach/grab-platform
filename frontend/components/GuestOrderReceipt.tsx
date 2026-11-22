"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, type MerchantOrder } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { guestOrderToken } from "@/lib/guest-orders";
import { useT } from "@/lib/i18n";
import { PartnerOrderList } from "./PartnerOrders";

export default function GuestOrderReceipt({ id }: { id: string }) {
  const { api } = useAuth();
  const { pick } = useT();
  const [state, setState] = useState<{ id: string; order: MerchantOrder | null; error: string }>({ id, order: null, error: "" });
  const current = state.id === id ? state : null;

  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      const token = guestOrderToken(id);
      if (!token) {
        setState({ id, order: null, error: pick("Open this receipt in the browser tab used to place the order. Contact the store with your order number if you need help.", "សូមបើកបង្កាន់ដៃនេះក្នុងផ្ទាំងកម្មវិធីរុករកដែលបានប្រើដើម្បីបញ្ជាទិញ។ សូមទាក់ទងហាងជាមួយលេខបញ្ជាទិញ ប្រសិនបើអ្នកត្រូវការជំនួយ។") });
        return;
      }
      busy = true;
      try {
        const order = await api.guestOrder(id, token, ctrl.signal);
        if (!ctrl.signal.aborted) setState(s => ({ id, order: s.id === id && s.order && s.order.updatedAt > order.updatedAt ? s.order : order, error: "" }));
      } catch (err) {
        if (!ctrl.signal.aborted) setState(s => ({ id, order: s.id === id ? s.order : null, error: err instanceof ApiError && err.status === 404
          ? pick("This private receipt is unavailable in this tab.", "បង្កាន់ដៃឯកជននេះមិនអាចប្រើបានក្នុងផ្ទាំងនេះទេ។")
          : pick("Unable to refresh your order. We will retry shortly.", "មិនអាចធ្វើបច្ចុប្បន្នភាពការបញ្ជាទិញបានទេ។ យើងនឹងព្យាយាមម្តងទៀតក្នុងពេលបន្តិច។") }));
      } finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, id, pick]);

  const order = current?.order;
  return <>
    <div className="card mt-6 p-5">
      <h2 className="text-lg font-bold">{pick("GrabExpress guest order", "ការបញ្ជាទិញ GrabExpress ដោយមិនចូលគណនី")}</h2>
      <p className="mt-1 break-all text-sm text-muted">{pick("Order number", "លេខបញ្ជាទិញ")}: {id}</p>
      {current?.error && <p role="alert" className="mt-3 text-sm text-red-600">{current.error}</p>}
      {!order && !current?.error && <p role="status" className="mt-3 text-sm text-muted">{pick("Loading your order…", "កំពុងផ្ទុកការបញ្ជាទិញ…")}</p>}
      {order && <>
        <p className="mt-3 text-sm">{order.customerName} · {order.customerPhone}</p>
        <p className="mt-2 text-xs text-muted">{pick("Keep this tab open to follow your order. Save your order number for enquiries with the store.", "សូមរក្សាផ្ទាំងនេះឱ្យបើកដើម្បីតាមដានការបញ្ជាទិញ។ រក្សាទុកលេខបញ្ជាទិញសម្រាប់សាកសួរហាង។")}</p>
      </>}
      <Link href="/express" className="mt-3 inline-block text-sm font-semibold text-brand">{pick("Browse GrabExpress", "រកមើល GrabExpress")}</Link>
    </div>
    {order && <PartnerOrderList orders={[order]} error={false} placed={null}
      onChanged={next => setState({ id, order: next, error: "" })}
      onCancel={orderId => api.cancelGuestOrder(orderId, guestOrderToken(orderId) ?? "")} />}
  </>;
}
