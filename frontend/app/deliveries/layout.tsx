import type { Metadata } from "next";

export const metadata: Metadata = { title: "My deliveries" };
export default function Layout({ children }: LayoutProps<"/deliveries">) { return children; }
