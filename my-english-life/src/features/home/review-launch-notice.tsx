"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, LinkButton } from "@/components/ui";
import { dismissNotice, isNoticeDismissed, shouldShowLaunchNotice, type ReviewSettingsLike } from "@/lib/review-plan";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * 起動時のお知らせ「今日の復習があります」
 * - 自動復習ON・お知らせON・今日の出題対象がある時だけ表示
 * - 画面遷移は強制しない
 * - 「あとで」を押したら、同じ起動セッションでは再表示しない
 */
export function ReviewLaunchNotice({
  settings,
  count,
  today,
}: {
  settings: ReviewSettingsLike;
  count: number;
  today: string;
}) {
  // sessionStorage はブラウザでしか読めないので、マウント後に判定する
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    setDismissed(isNoticeDismissed(sessionStore(), today));
  }, [today]);

  if (dismissed === null) return null;
  if (!shouldShowLaunchNotice({ settings, queueLength: count, dismissed })) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-3xl border border-primary bg-primary-soft p-5 shadow-card"
      aria-label="今日の復習のお知らせ"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary">
          <BellRing size={22} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">今日の復習があります</p>
          <p className="text-sm text-ink-muted">
            <b className="text-lg text-ink">{count}</b> 枚。思い出す練習で、使える英語にしていきましょう。
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
        <LinkButton href="/review" size="md">
          復習を始める
        </LinkButton>
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            dismissNotice(sessionStore(), today);
            setDismissed(true);
          }}
        >
          あとで
        </Button>
      </div>
    </section>
  );
}
