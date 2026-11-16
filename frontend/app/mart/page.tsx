import { redirect } from "next/navigation";

/** Compatibility for old bookmarks: Mart has been replaced by Express. */
export default function MartPage() { redirect("/express"); }
