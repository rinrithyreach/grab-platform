import type { Metadata } from "next";
import { Suspense } from "react";
import MerchantStorefront from "@/components/MerchantStorefront";
import { T } from "@/lib/i18n";

export const metadata: Metadata = { title: "Merchant products & services" };

export default function MerchantCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status" className="mx-auto max-w-6xl p-8 text-muted"><T k="merchant.loading" /></p>}><MerchantContent params={params} /></Suspense>;
}

async function MerchantContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MerchantStorefront key={id} id={id} />;
}
