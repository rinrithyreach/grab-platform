import type { Metadata } from "next";
import { Suspense } from "react";
import OrderHistory from "@/components/OrderHistory";

export const metadata: Metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">My orders</h1>
      {/* OrderHistory reads ?placed=… from the URL, which needs a Suspense boundary with cacheComponents. */}
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <OrderHistory />
      </Suspense>
    </div>
  );
}
