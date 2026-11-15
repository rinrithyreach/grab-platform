import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Khmer } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import SettingsScript from "@/components/SettingsScript";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import SkipLink from "@/components/SkipLink";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Khmer letters, so Khmer text falls back to this font.
const notoKhmer = Noto_Sans_Khmer({
  variable: "--font-khmer",
  subsets: ["khmer"],
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — Rides, Food & Mart`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The settings script changes data-theme/lang before React hydrates,
    // so the <html> attributes are allowed to differ from the server HTML.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoKhmer.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SettingsScript />
        <AuthProvider>
          <SkipLink />
          <Navbar />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
          <Footer />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
