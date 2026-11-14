"use client";

/**
 * Reusable slideshow. Give it any number of slides (React elements).
 * - Moves to the next slide every `interval` ms, looping back to the first
 * - Pauses while the mouse is over it or a control has keyboard focus
 * - Arrows, dots, swipe on touch screens, and ← / → keys
 * - No auto-play for users who turned on "reduce motion" in their system settings
 * - `hero`: full-width with no rounded corners and dots drawn on top of the slides
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

interface Props {
  slides: ReactNode[];
  label: string;
  interval?: number;
  hero?: boolean;
}

export default function Carousel({ slides, label, interval = 5000, hero = false }: Props) {
  const { t } = useT();
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const current = count ? index % count : 0; // stays valid if the number of slides changes

  const go = (i: number) => setIndex(((i % count) + count) % count);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(id);
  }, [count, paused, interval, current]); // `current` restarts the timer after a manual change

  if (!count) return null;

  const arrow = "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-2xl leading-none text-black shadow-md backdrop-blur hover:bg-white sm:grid";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(current - 1);
        if (e.key === "ArrowRight") go(current + 1);
      }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className={`overflow-hidden ${hero ? "" : "rounded-2xl"}`}>
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={t("carousel.slide", { n: i + 1, total: count })}
              aria-hidden={i !== current}
              inert={i !== current}
              className="w-full shrink-0"
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button type="button" onClick={() => go(current - 1)} aria-label={t("carousel.prev")} className={`${arrow} left-3 lg:left-6`}>‹</button>
          <button type="button" onClick={() => go(current + 1)} aria-label={t("carousel.next")} className={`${arrow} right-3 lg:right-6`}>›</button>
          {/* In hero mode the service cards overlap the bottom 2rem, so the dots sit above that. */}
          <div className={`flex justify-center gap-2 ${hero ? "absolute inset-x-0 bottom-14" : "mt-3"}`}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={t("carousel.goTo", { n: i + 1 })}
                aria-current={i === current}
                className={`h-2 rounded-full transition-all ${
                  hero
                    ? i === current ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                    : i === current ? "w-6 bg-brand" : "w-2 bg-border hover:bg-muted"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
