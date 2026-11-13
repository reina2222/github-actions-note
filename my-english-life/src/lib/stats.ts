/**
 * 学習記録の集計（保存データから計算する純粋関数）
 *
 * 用語の定義:
 *   - 習得済み: 「覚えた」が4回連続したカード（srs.ts の MASTERY_STREAK）。「忘れた」「あやふや」で解除される
 *   - 今日復習したカード数: 今日、復習で答えたカードの種類数（同じカードの再挑戦は1枚と数える）
 *   - 復習達成率（今日）: 今日復習したカード数 ÷（今日復習したカード数 ＋ 今日まだ残っている復習カード数）
 *   - 連続学習日数: 登録・復習をした日が続いている日数（今日まだでも昨日まで続いていれば継続）
 */
import { addDays, weekDays, type LocalDate } from "./dates";
import { planTodaysReview } from "./review-plan";
import type { Snapshot } from "./store/types";

function activeDates(snapshot: Snapshot): Set<LocalDate> {
  return new Set(snapshot.activity.filter((a) => a.corrections + a.reviews + a.saves > 0).map((a) => a.date));
}

export function currentStreak(snapshot: Snapshot, today: LocalDate): number {
  const days = activeDates(snapshot);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function weekProgress(snapshot: Snapshot, today: LocalDate) {
  const days = activeDates(snapshot);
  return weekDays(today).map((date) => ({
    date,
    done: days.has(date),
    isToday: date === today,
    isFuture: date > today,
  }));
}

export function reviewedTodayCount(snapshot: Snapshot, today: LocalDate): number {
  return new Set(snapshot.reviewLogs.filter((l) => l.reviewedOn === today).map((l) => l.entryId)).size;
}

export function summarize(snapshot: Snapshot, today: LocalDate) {
  const plan = planTodaysReview(snapshot, today);
  const reviewedToday = reviewedTodayCount(snapshot, today);
  const remainingToday = plan.queue.length;
  const target = reviewedToday + remainingToday;
  return {
    /** 今日の復習カード数（自動復習OFFなら0、1日の上限を適用） */
    dueToday: remainingToday,
    reviewPlan: plan,
    wordCount: snapshot.entries.filter((e) => e.kind === "word").length,
    phraseCount: snapshot.entries.filter((e) => e.kind === "phrase").length,
    totalCount: snapshot.entries.length,
    reviewedToday,
    /** 0〜100。今日の復習対象が無ければ null */
    achievementRate: target > 0 ? Math.round((reviewedToday / target) * 100) : null,
    masteredCount: snapshot.reviewStates.filter((r) => r.mastered).length,
    streak: currentStreak(snapshot, today),
    studyDays: activeDates(snapshot).size,
    reviewsDone: snapshot.reviewLogs.length,
    week: weekProgress(snapshot, today),
  };
}
export type Summary = ReturnType<typeof summarize>;
