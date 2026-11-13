import type { Metadata } from "next";

import { OfflineScreen } from "@/features/offline/offline-screen";

export const metadata: Metadata = { title: "オフライン" };

/** Service Worker が、保存していない画面を開こうとしたときに表示する */
export default function OfflinePage() {
  return <OfflineScreen />;
}
