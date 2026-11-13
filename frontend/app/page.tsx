import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { STORES } from "@/lib/catalog";
import StoreCard from "@/components/StoreCard";

const SERVICES = [
  { href: "/ride", emoji: "🚗", title: "Ride", text: "Get where you're going, fast and safe." },
  { href: "/food", emoji: "🍜", title: "Food", text: "Local favourites delivered hot." },
  { href: "/mart", emoji: "🛒", title: "Mart", text: "Groceries and essentials in minutes." },
];

const STEPS = [
  { emoji: "📱", title: "Pick a service", text: "Ride, food or mart — all in one app." },
  { emoji: "📍", title: "Set your location", text: "Tell us where to pick up or deliver." },
  { emoji: "⚡", title: "Sit back", text: "Track it live until it arrives." },
];

export default function Home() {
  const featured = STORES.filter((s) => s.kind === "food").sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-strong text-white dark:text-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-medium">Everyday super-app</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Everything you need,<br />one tap away.
            </h1>
            <p className="mt-4 max-w-md text-lg opacity-90">{BRAND.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/ride" className="btn bg-white text-brand hover:bg-white/90">🚗 Book a ride</Link>
              <Link href="/food" className="btn border border-white/40 hover:bg-white/10">🍜 Order food</Link>
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-4 md:grid" aria-hidden>
            {["🚗", "🍔", "🛒", "🧋"].map((e, i) => (
              <div key={e} className={`grid aspect-square place-items-center rounded-3xl bg-white/10 text-7xl ${i % 2 ? "translate-y-6" : ""}`}>{e}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto -mt-8 max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.title} href={s.href} className="card flex items-center gap-4 p-5 shadow-sm transition-shadow hover:shadow-lg">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-3xl">{s.emoji}</span>
              <span>
                <span className="block text-lg font-bold">{s.title}</span>
                <span className="text-sm text-muted">{s.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">Top rated near you</h2>
          <Link href="/food" className="text-sm font-semibold text-brand">See all →</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((s) => <StoreCard key={s.id} store={s} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6">
              <p className="text-3xl">{s.emoji}</p>
              <p className="mt-3 font-bold">{i + 1}. {s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
