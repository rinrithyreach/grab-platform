"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useHydratedPathname } from "@/lib/navigation";
import { platformNotice } from "@/lib/admin-settings";
import { setPlatformSettings, usePlatformSettings } from "@/lib/platform";

export default function PlatformStatus() {
  const { api } = useAuth();
  const pathname = useHydratedPathname();
  const settings = usePlatformSettings();
  useEffect(() => {
    const ctrl = new AbortController(); let busy = false;
    const refresh = async () => {
      if (busy) return; busy = true;
      try { const data = await api.platformSettings(ctrl.signal); if (!ctrl.signal.aborted) setPlatformSettings(data); }
      catch { /* Booking endpoints still enforce availability when this public read fails. */ }
      finally { busy = false; }
    };
    void refresh(); const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 30000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api]);
  const notices = platformNotice(settings, pathname);
  return notices.length ? <div role="status" className="border-b border-border bg-brand-soft px-4 py-3 text-center text-sm text-foreground">{notices.map((notice, index) => <p key={index}>{notice}</p>)}</div> : null;
}
