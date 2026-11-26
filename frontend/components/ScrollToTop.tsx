"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/** How far down (px) the page must be scrolled before the button appears. */
const SHOW_AFTER = 400;

/**
 * Floating "Back to top" button, shown once the visitor has scrolled down the page.
 * The ring around it fills as the page is read, so it also shows how far down you are.
 */
export default function ScrollToTop() {
  const { pick } = useT();
  const button = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      // Written straight to the style so scrolling never re-renders React.
      button.current?.style.setProperty("--scroll-progress", String(progress));
      setVisible(window.scrollY > SHOW_AFTER);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function goUp() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // Keyboard and screen-reader users continue from the top of the page content.
    document.getElementById("main")?.focus({ preventScroll: true });
  }

  const label = pick("Back to top", "ត្រឡប់ទៅខាងលើ");
  return (
    // Hidden with `visibility` (in CSS) so it fades out and leaves the tab order.
    <button ref={button} type="button" onClick={goUp} className="scroll-top" data-visible={visible} aria-label={label} title={label}>
      <svg className="scroll-top-ring" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="scroll-top-track" cx="26" cy="26" r="24" pathLength={100} />
        <circle className="scroll-top-progress" cx="26" cy="26" r="24" pathLength={100} />
      </svg>
      <svg className="scroll-top-arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      </svg>
    </button>
  );
}
