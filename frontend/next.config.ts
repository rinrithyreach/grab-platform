import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: process.env.NEXT_PUBLIC_SITE_URL ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname] : [],
  headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      // Compatible with prerendered pages and their Next.js inline scripts.
      { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
    ] }];
  },
  // Every browser talks to its own frontend origin. All clones can point this
  // server-side setting at ONE shared API without exposing SQL/JWT secrets.
  rewrites() {
    const api = (process.env.API_PROXY_URL || "http://localhost:5000").replace(/\/$/, "");
    return [{ source: "/backend/:path*", destination: `${api}/:path*` }];
  },
  // Redirect retired storefront URLs before streaming/caching any page content.
  redirects() {
    return ["/mart", "/store/daily-mart", "/store/home-plus"].map((source) => ({ source, destination: "/express", permanent: false }));
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // Serve photos as AVIF (smallest) or WebP when the browser supports them.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  partialPrefetching: true,
  turbopack: {
    // The frontend owns its dependencies; the repository also has an empty root lockfile.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
