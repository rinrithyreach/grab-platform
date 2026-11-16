import type { Metadata } from "next";

// Sets the browser tab title for this page (the page itself is a Client Component).
export const metadata: Metadata = { title: "Log in" };

export default function Layout({ children }: LayoutProps<"/login">) {
  return children;
}
