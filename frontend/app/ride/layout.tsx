import type { Metadata } from "next";

// Sets the browser tab title for this page (the page itself is a Client Component).
export const metadata: Metadata = { title: "Book a ride" };

export default function Layout({ children }: LayoutProps<"/ride">) {
  return children;
}
