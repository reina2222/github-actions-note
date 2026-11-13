/**
 * 今日の復習プラン（1日の上限・ON/OFF・お知らせ表示の判定）
 * 純粋関数のみ。画面と保存先の両方から使う。
 */
import type { LocalDate } from "./dates";
import { dueQueue, type ReviewState } from "./srs";

export const DAILY_LIMIT_OPTIONS = [5, 10, 20, null] as const;
export type DailyLimit = (typeof DAILY_LIMIT_OPTIONS)[number];

export type ReviewLogLike = {
  entryId: string;
  reviewedOn: LocalDate;
  source: "auto" | "manual";
  isRetry: boolean;
};

export type ReviewSettingsLike = {
  autoReview: boolean;
  launchNotice: boolean;
  dailyLimit: DailyLimit;
};

/** 今日、自動復習ですでに出題したフレーズ数（再挑戦・手動復習は数えない） */
export function reviewedTodayCount(logs: readonly ReviewLogLike[], today: LocalDate): number {
  return new Set(logs.filter((l) => l.reviewedOn === today && l.source === "auto" && !l.isRetry).map((l) => l.entryId))
    .size;
}

export type TodaysReviewPlan = {
  enabled: boolean;
  /** 期限が来ているフレーズの総数（上限に関係なく） */
  dueTotal: number;
  /** 今日まだ出題できるフレーズ（期限が古い順・上限適用後） */
  queue: string[];
  doneToday: number;
  limit: number | null;
  /** 上限で今日は出題しない分（翌日以降に持ち越し・削除しない） */
  carriedOver: number;
};

export function planTodaysReview(
  input: { reviewStates: readonly ReviewState[]; reviewLogs: readonly ReviewLogLike[]; settings: ReviewSettingsLike },
  today: LocalDate,
): TodaysReviewPlan {
  const due = dueQueue(input.reviewStates, today);
  const doneToday = reviewedTodayCount(input.reviewLogs, today);
  const limit = input.settings.dailyLimit;
  if (!input.settings.autoReview) {
    return { enabled: false, dueTotal: due.length, queue: [], doneToday, limit, carriedOver: 0 };
  }
  const remaining = limit === null ? due.length : Math.max(0, limit - doneToday);
  const queue = due.slice(0, remaining);
  return { enabled: true, dueTotal: due.length, queue, doneToday, limit, carriedOver: due.length - queue.length };
}

export function shouldShowLaunchNotice(args: {
  settings: ReviewSettingsLike;
  queueLength: number;
  dismissed: boolean;
}): boolean {
  return args.settings.autoReview && args.settings.launchNotice && args.queueLength > 0 && !args.dismissed;
}

/* ---------- 「あとで」の記録（起動セッション内のみ = sessionStorage） ---------- */

export const NOTICE_DISMISS_KEY = "mel:review-notice-dismissed";
type SessionStore = Pick<Storage, "getItem" | "setItem">;

/** 同じ起動セッション・同じ日に「あとで」を押していれば true */
export function isNoticeDismissed(store: SessionStore | null, today: LocalDate): boolean {
  try {
    return store?.getItem(NOTICE_DISMISS_KEY) === today;
  } catch {
    return false;
  }
}

export function dismissNotice(store: SessionStore | null, today: LocalDate) {
  try {
    store?.setItem(NOTICE_DISMISS_KEY, today);
  } catch {
    // 保存できなくても、画面上の状態で非表示にする
  }
}
