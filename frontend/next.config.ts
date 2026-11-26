import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
const apiUpstream = new URL(process.env.API_PROXY_URL || "http://localhost:5000");
const browserApi = process.env.NEXT_PUBLIC_API_URL || "/backend";
// A relative browser API uses the frontend origin. An explicit direct API needs its own CSP source.
if (/[\\\s?#]/u.test(browserApi) || browserApi.startsWith("//"))
  throw new Error("Configure the browser API as a local absolute path or an HTTP(S) base URL.");
const directApi = browserApi.startsWith("/") ? null : new URL(browserApi);
for (const url of [apiUpstream, directApi]) {
  if (!url) continue;
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("Configure API URLs as HTTP(S) base URLs without credentials, query strings, or fragments.");
  if (production && url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Production connections to a remote API require HTTPS.");
}
const csp = [
  "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
  "frame-src 'none'", "script-src-attr 'none'",
  // Prerendered Next pages include inline bootstrap scripts. Development also needs the HMR evaluator.
  production ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  ...(production ? [
    "default-src 'self'", "style-src 'self' 'unsafe-inline'",
    `connect-src 'self'${directApi ? ` ${directApi.origin}` : ""}`,
    `img-src 'self' data: blob: https://tile.openstreetmap.org${directApi ? ` ${directApi.origin}` : ""}`,
    "font-src 'self'", "worker-src 'self' blob:",
  ] : []),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: process.env.NEXT_PUBLIC_SITE_URL ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname] : [],
  headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      { key: "Content-Security-Policy", value: csp },
    ] }];
  },
  // Every browser talks to its own frontend origin. All clones can point this
  // server-side setting at ONE shared API without exposing SQL/JWT secrets.
  rewrites() {
    const api = apiUpstream.href.replace(/\/$/, "");
    return [
      { source: "/backend/api/:path*", destination: `${api}/api/:path*` },
      { source: "/backend/health", destination: `${api}/health` },
    ];
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
