import { Suspense } from "react";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default function AdminPage() {
  return <Suspense fallback={<div className="admin-loading" role="status">Loading admin workspace…</div>}><AdminDashboard /></Suspense>;
}
