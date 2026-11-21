import type { Metadata, Viewport } from "next";
import { Suspense, ViewTransition } from "react";
import { Geist, Noto_Sans_Khmer } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import SettingsScript from "@/components/SettingsScript";
import Navbar from "@/components/Navbar";
import AccountSync from "@/components/AccountSync";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import SkipLink from "@/components/SkipLink";
import LocalizedTitle from "@/components/LocalizedTitle";
import PlatformStatus from "@/components/PlatformStatus";
import ViewTransitionGuard from "@/components/ViewTransitionGuard";
import AppMotion from "@/components/AppMotion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist has no Khmer letters, so Khmer text falls back to this font.
// Not preloaded: most visitors read English, and the browser fetches it as soon as Khmer text appears.
const notoKhmer = Noto_Sans_Khmer({
  variable: "--font-khmer",
  subsets: ["khmer"],
  preload: false,
});

// The site's public address, used to build full links in link previews.
// Set NEXT_PUBLIC_SITE_URL when the website is hosted somewhere; defaults to local development.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#008f41",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name} — Rides, Food & Express`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  // Link previews on Telegram, Facebook, X... (the image comes from app/opengraph-image.tsx)
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — Rides, Food & Express`,
    description: BRAND.tagline,
    locale: "en_US",
    alternateLocale: ["km_KH"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — Rides, Food & Express`,
    description: BRAND.tagline,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The settings script changes data-theme/lang before React hydrates,
    // so the <html> attributes are allowed to differ from the server HTML.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${notoKhmer.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SettingsScript />
        <ViewTransitionGuard />
        <AuthProvider>
          <Suspense fallback={null}><LocalizedTitle /></Suspense>
          <SkipLink />
          <Suspense fallback={<div className="h-16 border-b border-border bg-surface" aria-busy="true" />}><Navbar /></Suspense>
          <AccountSync />
          <Suspense fallback={null}><AppMotion /></Suspense>
          <Suspense fallback={null}><PlatformStatus /></Suspense>
          <main id="main" tabIndex={-1} className="page-enter flex-1 outline-none">
            {/* Fades each new page in on navigation (browsers without View Transitions just swap instantly). */}
            <ViewTransition default="page">{children}</ViewTransition>
          </main>
          <Suspense fallback={<div className="mt-16 h-40 border-t border-border bg-surface" aria-busy="true" />}><Footer /></Suspense>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
