import type { Metadata } from "next";

export const metadata: Metadata = { title: "GrabExpress — Shop & deliver" };
export default function Layout({ children }: LayoutProps<"/express">) { return children; }
