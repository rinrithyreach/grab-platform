import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORES, getStore } from "@/lib/catalog";
import MenuItemCard from "@/components/MenuItemCard";
import CartBar from "@/components/CartBar";

export function generateStaticParams() {
  return STORES.map((s) => ({ id: s.id }));
}

export async function generateMetadata(props: PageProps<"/store/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: getStore(id)?.name ?? "Store" };
}

export default async function StorePage(props: PageProps<"/store/[id]">) {
  const { id } = await props.params;
  const store = getStore(id);
  if (!store) notFound();

  const popular = store.items.filter((i) => i.popular);
  const back = store.kind === "mart" ? { href: "/mart", label: "Mart" } : { href: "/food", label: "Food" };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-28">
      <Link href={back.href} className="text-sm text-muted hover:text-brand">← Back to {back.label}</Link>

      <section className="card mt-4 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-brand-soft text-5xl">{store.emoji}</div>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{store.name}</h1>
          <p className="mt-1 text-muted">{store.cuisine} · {"$".repeat(store.priceLevel)}</p>
          <p className="mt-2 flex flex-wrap gap-4 text-sm">
            <span>⭐ {store.rating.toFixed(1)}</span>
            <span>🕒 {store.etaMinutes} min</span>
            {store.promo && <span className="rounded-full bg-accent/20 px-2 font-medium">🏷️ {store.promo}</span>}
          </p>
        </div>
      </section>

      {popular.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Popular</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {popular.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">{store.kind === "mart" ? "All products" : "Full menu"}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {store.items.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} />)}
        </div>
      </section>

      <CartBar />
    </div>
  );
}
