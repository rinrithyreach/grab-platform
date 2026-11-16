import type { Metadata } from "next";

export const metadata: Metadata = { title: "GrabExpress — Send a parcel" };
export default function Layout({ children }: LayoutProps<"/express">) { return children; }
