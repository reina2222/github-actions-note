"use client";

import { WifiOff } from "lucide-react";
import { useEffect } from "react";

import { useFocusMode } from "@/lib/focus-mode";
import { useOnline } from "@/lib/use-online";

/**
 * Service Worker の登録（本番ビルドのみ）
 * 開発中（npm run dev）は古い画面がキャッシュされて混乱しないよう登録しない。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // 登録できなくてもオンラインでは普通に使える
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

/** オフライン中の案内（責めない・短い文言で） */
export function OfflineBanner() {
  const online = useOnline();
  const focusMode = useFocusMode();
  if (online || focusMode) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-1.5 bg-warning-soft px-4 py-1.5 text-xs text-ink"
    >
      <WifiOff size={14} aria-hidden />
      オフラインで使用中：すべての機能が使えます
    </div>
  );
}
