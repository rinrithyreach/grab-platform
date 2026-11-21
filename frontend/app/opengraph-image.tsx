import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

/**
 * The preview picture shown when the website link is shared on Telegram, Facebook, etc.
 * Generated once at build time (1200×630 is the size those apps expect).
 * See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md
 */
export const alt = `${BRAND.name} — rides, food and parcel delivery in one website`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "80px", color: "white", fontFamily: "sans-serif",
          background: "linear-gradient(135deg, #008f41 0%, #007333 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div style={{ width: 120, height: 120, borderRadius: 32, background: "white", color: "#008f41", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 800 }}>
            {BRAND.name[0]}
          </div>
          <div style={{ fontSize: 96, fontWeight: 800 }}>{BRAND.name}</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 56, fontWeight: 700 }}>Everything you need, one tap away.</div>
        <div style={{ marginTop: 20, fontSize: 36, opacity: 0.9 }}>🚗 Rides · 🍜 Food · 📦 Express</div>
        <div style={{ marginTop: "auto", fontSize: 24, opacity: 0.75 }}>University project (Group 6) · not affiliated with Grab Holdings</div>
      </div>
    ),
    size,
  );
}
