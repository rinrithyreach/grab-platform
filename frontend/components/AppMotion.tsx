"use client";

import { useEffect } from "react";
import { useHydratedPathname } from "@/lib/navigation";

/** Progressive enhancement: content is always readable without JavaScript or motion. */
export default function AppMotion() {
  const pathname = useHydratedPathname();
  useEffect(() => {
    if (pathname.startsWith("/admin") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.getElementById("main");
    if (!root || !("IntersectionObserver" in window)) return;
    const seen = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver((entries) => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (document.visibilityState === "hidden" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) continue;
        // Animate below-the-fold panels; route transitions handle the first viewport.
        if (entry.boundingClientRect.top < 80) continue;
        const animation = entry.target.animate(
          [{ opacity: 0.35, translate: "0 14px" }, { opacity: 1, translate: "0 0" }],
          { duration: 440, delay: Math.min(order++ * 45, 180), easing: "cubic-bezier(.2,.7,.2,1)" },
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: 0.08 });
    const scan = () => root.querySelectorAll("[data-reveal], section:not(section section), .card:not(section .card)").forEach((element) => {
      if (seen.has(element) || element.closest("dialog, [role=dialog]")) return;
      seen.add(element);
      observer.observe(element);
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); animations.forEach((animation) => animation.cancel()); };
  }, [pathname]);
  return null;
}
