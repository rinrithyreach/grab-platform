import type { Metadata } from "next";

// Sets the browser tab title for this page (the page itself is a Client Component).
export const metadata: Metadata = { title: "My rides" };

export default function Layout({ children }: LayoutProps<"/rides">) {
  return children;
}
