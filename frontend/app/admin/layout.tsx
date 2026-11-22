import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = { title: "Super Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // No lang here: <html lang> follows the Language setting (English / Khmer).
  return <div className="admin-root">{children}</div>;
}
