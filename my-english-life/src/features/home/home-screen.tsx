"use client";

import Link from "next/link";
import {
  ChartColumn,
  ChevronRight,
  Flame,
  MessageCircleQuestion,
  MessageSquareQuote,
  NotebookPen,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Card, Chip, LinkButton, LoadingBlock, SectionTitle, StoreError, cn } from "@/components/ui";
import { toLocalDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { summarize } from "@/lib/stats";
import { useLearning } from "@/lib/store/learning-provider";

import { ReviewLaunchNotice } from "./review-launch-notice";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function greeting(hour: number) {
  if (hour < 11) return "おはようございます！";
  if (hour < 18) return "こんにちは！";
  return "こんばんは！";
}

function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
        <Icon size={16} className="text-primary" aria-hidden />
        {label}
      </span>
      <span className="mt-1 block">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        <span className="ml-1 text-sm text-ink-muted">{unit}</span>
      </span>
    </>
  );
  const cls = "block rounded-3xl border border-line bg-surface p-4 shadow-card";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function HomeScreen() {
  const { snapshot, status } = useLearning();

  if (status === "error")
    return (
      <div className="pt-6">
        <StoreError />
      </div>
    );

  const now = new Date();
  const today = toLocalDate(now);
  const s = snapshot ? summarize(snapshot, today) : null;
  const goal = snapshot?.settings.weeklyGoalDays ?? 5;
  const doneThisWeek = s?.week.filter((d) => d.done).length ?? 0;

  return (
    <div className="space-y-5 pt-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary" aria-hidden>
            <MessageCircleQuestion size={20} />
          </span>
          <h1 className="text-lg font-bold">My English Life</h1>
        </div>
        {s && (
          <Chip tone="warning" className="text-sm">
            <Flame size={16} aria-hidden />
            連続 {s.streak}日
          </Chip>
        )}
      </header>

      {s && snapshot && <ReviewLaunchNotice settings={snapshot.settings} count={s.dueToday} today={today} />}

      <section
        className="rounded-3xl bg-gradient-to-br from-lavender via-primary-soft to-surface p-5"
        aria-label="あいさつ"
      >
        <p className="text-sm font-bold text-primary">{greeting(now.getHours())}</p>
        <p className="mt-1 text-xl font-bold leading-snug">
          覚えた英語を、
          <br />
          使える英語に。
          <Sparkles size={18} className="ml-1 inline text-primary" aria-hidden />
        </p>
      </section>

      <LinkButton href={routes.newWord} full icon={Plus}>
        単語・フレーズを登録
      </LinkButton>

      {!s ? (
        <LoadingBlock />
      ) : (
        <>
          {s.totalCount === 0 && (
            <Card tone="primary">
              <SectionTitle icon={Sparkles}>はじめての方へ</SectionTitle>
              <ol className="space-y-2 text-sm">
                <li>
                  <b>1.</b> 覚えたい英単語・フレーズを登録（音声入力もOK）
                </li>
                <li>
                  <b>2.</b> 意味・例文・メモを自分の言葉で残す（分からない所は空欄でOK）
                </li>
                <li>
                  <b>3.</b> 翌日から 1・3・7・14・30・60日後 に復習が届きます
                </li>
              </ol>
            </Card>
          )}

          <Card>
            {!s.reviewPlan.enabled ? (
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-ink-muted">
                  <RotateCcw size={26} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-bold">自動復習はOFFです</p>
                  <p className="text-ink-muted">
                    単語帳からいつでも復習できます。
                    <Link href="/mypage" className="font-bold text-primary underline">
                      マイページ
                    </Link>
                    でONにできます。
                  </p>
                </div>
              </div>
            ) : s.dueToday > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <RotateCcw size={26} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-muted">今日の復習カード</p>
                  <p className="text-2xl font-bold">
                    {s.dueToday}
                    <span className="ml-1 text-sm font-normal text-ink-muted">枚</span>
                  </p>
                </div>
                <LinkButton href="/review" size="md" iconRight={ChevronRight}>
                  始める
                </LinkButton>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-success-soft text-success">
                  <Trophy size={26} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  {s.reviewedToday > 0 ? (
                    <>
                      <p className="font-bold">今日の復習はできました</p>
                      <p className="text-ink-muted">
                        {s.reviewPlan.carriedOver > 0
                          ? `残りの${s.reviewPlan.carriedOver}枚は明日以降に出てきます。`
                          : "よくがんばりました。また明日も少しずつ。"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold">今日の復習カードはありません</p>
                      <p className="text-ink-muted">新しい単語やフレーズを登録してみましょう。</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={NotebookPen} label="登録した単語" value={s.wordCount} unit="語" href={routes.words} />
            <StatTile icon={MessageSquareQuote} label="フレーズ" value={s.phraseCount} unit="件" href={routes.words} />
            <StatTile icon={RotateCcw} label="今日復習した" value={s.reviewedToday} unit="枚" />
            <StatTile icon={Trophy} label="習得済み" value={s.masteredCount} unit="枚" href="/analytics" />
          </div>

          <Card>
            <SectionTitle
              action={
                <span className="text-sm text-ink-muted">
                  目標 <b className="text-ink">{doneThisWeek}</b> / {goal}日
                </span>
              }
            >
              今週の学習
            </SectionTitle>
            <ol className="grid grid-cols-7 gap-1" aria-label="今週の学習状況">
              {s.week.map((d, i) => (
                <li key={d.date} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 text-xs font-bold",
                      d.done ? "border-success bg-success text-surface" : "border-line text-ink-subtle",
                      d.isToday && !d.done && "border-primary",
                    )}
                    aria-label={`${WEEKDAY_LABELS[i]}曜日 ${d.done ? "学習済み" : d.isFuture ? "これから" : "未学習"}`}
                  >
                    {d.done ? "✓" : ""}
                  </span>
                  <span className={cn("text-xs", d.isToday ? "font-bold text-primary" : "text-ink-muted")}>
                    {WEEKDAY_LABELS[i]}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <LinkButton href="/analytics" full variant="secondary" icon={ChartColumn} iconRight={ChevronRight}>
            学習記録をくわしく見る
          </LinkButton>
        </>
      )}
    </div>
  );
}
