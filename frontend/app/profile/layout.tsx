import type { Metadata } from "next";

// Sets the browser tab title for this page (the page itself is a Client Component).
export const metadata: Metadata = { title: "My profile" };

export default function Layout({ children }: LayoutProps<"/profile">) {
  return children;
}
