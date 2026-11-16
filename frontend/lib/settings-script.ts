/** Shared between the server layout (inline script) and the client settings store. */
export type Lang = "en" | "km";
export type Theme = "light" | "dark" | "system";
export interface Settings { lang: Lang; theme: Theme }

export const SETTINGS_KEY = "grab-settings";

/**
 * Runs in <head> before the page paints, so the saved theme/language apply with no flash.
 * See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export const SETTINGS_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");var t=s.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");if(s.lang==="km")r.lang="km"}catch(e){document.documentElement.setAttribute("data-theme",matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}})()`;
