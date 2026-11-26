"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAdminT } from "@/lib/admin-i18n";
import { BRAND } from "@/lib/brand";
import BrandMark from "../BrandMark";
import AdminIcon from "./AdminIcon";
import { LanguageSwitch, ThemeSwitch } from "./AdminPreferenceSwitches";

export default function AdminEntry({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { a } = useAdminT();
  return <div className="admin-entry">
    <header className="admin-entry-header">
      <Link href="/" aria-label={a("Back to {brand}", { brand: BRAND.name })}><BrandMark /></Link>
      <div className="admin-entry-prefs"><LanguageSwitch compact /><ThemeSwitch compact /></div>
    </header>
    <div className="admin-entry-main">
      <section className="admin-entry-card" aria-labelledby="admin-entry-title">
        <div className="admin-entry-band">
          <span>{a("Admin console")}</span>
          <span className="admin-entry-shield" aria-hidden="true"><AdminIcon name="shield" size={30} /></span>
        </div>
        <div className="admin-entry-body">
          <h1 id="admin-entry-title">{title}</h1>
          <p>{description}</p>
          {children}
        </div>
      </section>
      <Link href="/" className="admin-entry-back"><span aria-hidden="true">←</span> {a("Back to {brand}", { brand: BRAND.name })}</Link>
    </div>
  </div>;
}
