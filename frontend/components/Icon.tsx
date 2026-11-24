import type { CSSProperties, ReactNode } from "react";

export type IconName = "home" | "bag" | "heart" | "user" | "car" | "food" | "parcel" | "pin" | "search" | "arrow" | "clock" | "menu" | "close" | "wallet" | "star" | "chevron" | "settings" | "check" | "logout" | "camera" | "pencil" | "sun" | "moon" | "receipt" | "truck" | "store" | "bell" | "info" | "warning" | "alert" | "trash";

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  car: <><path d="m5 6-2 7v6h3v-3h12v3h3v-6l-2-7H5ZM3 12h18" /><path d="M7 6V4h10v2M6 15h1m10 0h1" /></>,
  food: <><path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 2-5 8-1 10h1" /></>,
  parcel: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v10l9 5 9-5V8M12 13v10M7.5 5.5l9 5V15" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  wallet: <><path d="M20 8V5H5a2 2 0 0 1 0-4h13v4M3 3v17a1 1 0 0 0 1 1h16V8H4M20 12h-5v5h5" /></>,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2Z" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="3" fill="var(--surface)" /><circle cx="16" cy="17" r="3" fill="var(--surface)" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  logout: <><path d="M9 4H4v16h5m6-13 5 5-5 5M9 12h11" /></>,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v14H3V7Z" /><circle cx="12" cy="13" r="4" /></>,
  pencil: <><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 6 5-2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  store: <><path d="M3 9 4.5 4h15L21 9M3 9v1.5a3 3 0 0 0 6 0V9m0 1.5a3 3 0 0 0 6 0V9m0 1.5a3 3 0 0 0 6 0V9M3 9h18M5 13v8h14v-8M10 21v-5h4v5" /></>,
  truck: <><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" /><circle cx="6" cy="18" r="2" fill="var(--surface)" /><circle cx="17" cy="18" r="2" fill="var(--surface)" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.01" /></>,
  warning: <><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17v.01" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
};

export default function Icon({ name, className = "", filled = false, style }: { name: IconName; className?: string; filled?: boolean; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} style={style} aria-hidden="true">{paths[name]}</svg>;
}
