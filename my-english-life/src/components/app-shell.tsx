"use client";

import { useEffect, type ReactNode } from "react";

import { LearningProvider, useLearning } from "@/lib/store/learning-provider";

import { BottomNav } from "./bottom-nav";
import { OfflineBanner, ServiceWorkerRegister } from "./pwa";

/** 設定のテーマを <html data-theme> に反映する */
function ThemeSync() {
  const { snapshot } = useLearning();
  const theme = snapshot?.settings.theme;
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("mel:theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LearningProvider>
      <ThemeSync />
      <ServiceWorkerRegister />
      <OfflineBanner />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2"
      >
        本文へスキップ
      </a>
      <main id="main" className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-nav-space">
        {children}
      </main>
      <BottomNav />
    </LearningProvider>
  );
}
