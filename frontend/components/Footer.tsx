import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-brand">{BRAND.name}</p>
          <p className="mt-2 text-sm text-muted">{BRAND.tagline}</p>
        </div>
        <div>
          <p className="font-semibold">Services</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li><Link href="/ride" className="hover:text-brand">Book a ride</Link></li>
            <li><Link href="/food" className="hover:text-brand">Food delivery</Link></li>
            <li><Link href="/mart" className="hover:text-brand">Mart</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">About</p>
          <p className="mt-2 text-sm text-muted">
            University group project (Group 6) — a study of super-app platforms. Not affiliated with any real company.
          </p>
        </div>
      </div>
    </footer>
  );
}
