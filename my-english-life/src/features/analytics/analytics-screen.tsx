"use client";

import {
  CalendarCheck,
  Flame,
  MessageSquareQuote,
  NotebookPen,
  RotateCcw,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Card, LoadingBlock, PageHeader, SectionTitle, StoreError } from "@/components/ui";
import { toLocalDate } from "@/lib/dates";
import { MASTERY_STREAK } from "@/lib/srs";
import { summarize } from "@/lib/stats";
import { useLearning } from "@/lib/store/learning-provider";

function Stat({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
        <Icon size={16} className="text-primary" aria-hidden />
        {label}
      </p>
      <p className="mt-1">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="ml-1 text-sm text-ink-muted">{unit}</span>
      </p>
    </div>
  );
}

function Bar({ value, label, tone = "bg-primary" }: { value: number; label: string; tone?: string }) {
  return (
    <div
      className="h-3 overflow-hidden rounded-full bg-surface-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function AnalyticsScreen() {
  const { snapshot, status } = useLearning();
  if (status === "error")
    return (
      <div className="pt-6">
        <StoreError />
      </div>
    );

  if (!snapshot)
    return (
      <div>
        <PageHeader title="学習記録" back="/" />
        <LoadingBlock />
      </div>
    );

  const s = summarize(snapshot, toLocalDate());
  const masteryRate = s.totalCount ? Math.round((s.masteredCount / s.totalCount) * 100) : 0;

  return (
    <div>
      <PageHeader title="学習記録" back="/" />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={NotebookPen} label="登録した単語" value={s.wordCount} unit="語" />
          <Stat icon={MessageSquareQuote} label="登録したフレーズ" value={s.phraseCount} unit="件" />
          <Stat icon={RotateCcw} label="今日復習したカード" value={s.reviewedToday} unit="枚" />
          <Stat icon={Trophy} label="習得済みカード" value={s.masteredCount} unit="枚" />
          <Stat icon={Flame} label="連続学習" value={s.streak} unit="日" />
          <Stat icon={CalendarCheck} label="学習した日（合計）" value={s.studyDays} unit="日" />
        </div>

        <Card>
          <SectionTitle
            icon={Target}
            action={
              <span className="text-sm font-bold text-primary">
                {s.achievementRate === null ? "—" : `${s.achievementRate}%`}
              </span>
            }
          >
            今日の復習達成率
          </SectionTitle>
          <Bar value={s.achievementRate ?? 0} label="今日の復習達成率" />
          <p className="mt-2 text-xs text-ink-muted">
            {s.achievementRate === null
              ? "今日の復習カードはありません。"
              : `今日復習した ${s.reviewedToday}枚 ÷（復習した ${s.reviewedToday}枚 ＋ 残り ${s.dueToday}枚）`}
          </p>
        </Card>

        <Card>
          <SectionTitle icon={Trophy} action={<span className="text-sm font-bold text-success">{masteryRate}%</span>}>
            習得率
          </SectionTitle>
          <Bar value={masteryRate} label="習得率" tone="bg-success" />
          <p className="mt-2 text-xs text-ink-muted">
            「習得済み」＝ 復習で「覚えた」が{MASTERY_STREAK}
            回続いたカード。「忘れた」「あやふや」を選ぶと習得済みではなくなります。
          </p>
        </Card>

        <p className="px-1 text-xs text-ink-subtle">
          ※
          この端末に保存されたデータから計算しています。別の端末に移すときは、マイページの「バックアップ」を使ってください。
        </p>
      </div>
    </div>
  );
}
