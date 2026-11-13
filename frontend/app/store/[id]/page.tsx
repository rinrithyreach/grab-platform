import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { STORES, getStore } from "@/lib/catalog";
import StoreView from "@/components/StoreView";

export function generateStaticParams() {
  return STORES.map((s) => ({ id: s.id }));
}

export async function generateMetadata(props: PageProps<"/store/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: getStore(id)?.name ?? "Store" };
}

// Reading `params` happens inside <Suspense> so navigation to this page stays instant
// (fixes the "URL data outside of Suspense" Next.js insight).
export default function StorePage(props: PageProps<"/store/[id]">) {
  return (
    <Suspense fallback={<StoreSkeleton />}>
      <StoreContent params={props.params} />
    </Suspense>
  );
}

async function StoreContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore(id);
  if (!store) notFound();
  return <StoreView store={store} />;
}

function StoreSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-6">
      <div className="h-4 w-28 rounded bg-border" />
      <div className="card mt-4 h-40" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-24" />)}
      </div>
    </div>
  );
}
