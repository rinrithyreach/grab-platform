import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
