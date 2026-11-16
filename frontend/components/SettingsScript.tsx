"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";
import { SETTINGS_SCRIPT } from "@/lib/settings-script";

/**
 * Puts the saved theme/language script into the HTML before the page content,
 * so it runs before the first paint (no flash of the wrong theme).
 * Using useServerInsertedHTML instead of a plain <script> in the layout avoids
 * React's "Encountered a script tag" warning. The ref makes sure it's added only once.
 * See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export default function SettingsScript() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: SETTINGS_SCRIPT }} />;
  });
  return null;
}
