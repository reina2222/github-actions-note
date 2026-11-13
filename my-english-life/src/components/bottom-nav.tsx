"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Layers, NotebookPen, RotateCcw, UserRound, type LucideIcon } from "lucide-react";

import { useFocusMode } from "@/lib/focus-mode";

import { cn } from "./ui";

type Tab = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

export const TABS: readonly Tab[] = [
  { href: "/", label: "ホーム", icon: House, match: (p) => p === "/" || p.startsWith("/analytics") },
  { href: "/words", label: "単語登録", icon: NotebookPen, match: (p) => p.startsWith("/words") },
  { href: "/cards", label: "カード学習", icon: Layers, match: (p) => p.startsWith("/cards") },
  { href: "/review", label: "復習", icon: RotateCcw, match: (p) => p.startsWith("/review") },
  {
    href: "/mypage",
    label: "マイページ",
    icon: UserRound,
    match: (p) => p.startsWith("/mypage") || p.startsWith("/licenses"),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  // 集中入力モード中は隠して、入力欄にスペースを譲る
  if (useFocusMode()) return null;
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 shadow-float backdrop-blur pb-safe"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors",
                  active ? "text-primary" : "text-ink-subtle hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
