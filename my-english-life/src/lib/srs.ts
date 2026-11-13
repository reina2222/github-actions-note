/**
 * スマート復習（間隔反復）のスケジュール計算
 * ------------------------------------------------------------
 * 純粋で決定的な関数だけで構成した独立モジュール。
 * アルゴリズムを変えるときはこのファイルだけを差し替えればよい。
 *
 * 予定（学習日からの目安）: 1日 → 3日 → 7日 → 14日 → 30日 → 60日
 *
 * stage = 次に行う予定の復習が何回目か（0 = 翌日の1回目）
 *
 * ■ 適応型（adaptive）… 回答結果で次回を調整
 *   - 忘れた（again）  : 同じセッションの最後に再出題し、翌日にも復習。段階は最初に戻す
 *   - あやふや（close）: 翌日に復習。連続成功数をリセット（段階は維持）
 *   - 覚えた（got_it） : 段階を1つ進め、その段階の日数だけ間隔をあける（3→7→14→30→60日、以降60日ごと）
 *
 * ■ 固定間隔（fixed）… 学習日からの累積日程（1,3,7,14,30,60日目）で出題
 *   - 回答結果に関係なく次の予定日へ進む（もう一度はセッション内で再出題のみ）
 *   - 予定日を大きく過ぎていた場合、過ぎた分の予定を溜めずに「今日より後の次の予定日」へ進む
 *
 * 共通:
 *   - 同じセッション内の再挑戦（isRetry）は連続成功数に加算せず、予定も変えない
 *   - 習得済み（mastered）= 「覚えた」が MASTERY_STREAK（4）回連続。「忘れた」「あやふや」で解除
 *   - 期限を過ぎても状態は1件のまま（重複して作らない）。最も古い期限到来分として扱う
 */
import { addDays, diffDays, type LocalDate } from "./dates";

export const REVIEW_RATINGS = ["again", "close", "got_it"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

/** 画面での呼び方（内部の値は旧版と同じにして、記録を引き継ぐ） */
export const REVIEW_RATING_LABELS: Record<ReviewRating, string> = {
  again: "忘れた",
  close: "あやふや",
  got_it: "覚えた",
};

export const REVIEW_MODES = ["adaptive", "fixed"] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

/** 各段階の日数（固定間隔では学習日からの累積、適応型では前回からの間隔） */
export const REVIEW_STAGE_DAYS = [1, 3, 7, 14, 30, 60] as const;
const LAST_STAGE = REVIEW_STAGE_DAYS.length - 1;
const AFTER_LAST_DAYS = 60;

export const MASTERY_STREAK = 4;

export type ReviewState = {
  entryId: string;
  /** 学習日（保存した日） */
  startedOn: LocalDate;
  stage: number;
  dueOn: LocalDate;
  successStreak: number;
  lapses: number;
  totalReviews: number;
  mastered: boolean;
  lastReviewedOn: LocalDate | null;
  /** 最後の自己評価 */
  lastRating: ReviewRating | null;
};

export function createInitialReviewState(entryId: string, today: LocalDate): ReviewState {
  return {
    entryId,
    startedOn: today,
    stage: 0,
    dueOn: addDays(today, REVIEW_STAGE_DAYS[0]),
    successStreak: 0,
    lapses: 0,
    totalReviews: 0,
    mastered: false,
    lastReviewedOn: null,
    lastRating: null,
  };
}

/** 固定間隔: 学習日から stage 回目の予定日 */
export function fixedScheduleDate(startedOn: LocalDate, stage: number): LocalDate {
  const s = Math.max(0, stage);
  const offset =
    s <= LAST_STAGE ? REVIEW_STAGE_DAYS[s]! : REVIEW_STAGE_DAYS[LAST_STAGE]! + AFTER_LAST_DAYS * (s - LAST_STAGE);
  return addDays(startedOn, offset);
}

/** 固定間隔: fromStage 以降で、今日より後の最初の予定（過ぎた予定は溜めない） */
function nextFixed(startedOn: LocalDate, fromStage: number, today: LocalDate) {
  let stage = fromStage;
  let due = fixedScheduleDate(startedOn, stage);
  while (due <= today) {
    stage++;
    due = fixedScheduleDate(startedOn, stage);
  }
  return { stage, dueOn: due };
}

export type ReviewOutcome = {
  next: ReviewState;
  /** true のとき、同じセッションの末尾に再出題する */
  requeueInSession: boolean;
  /** 次回までの日数 */
  intervalDays: number;
};

export type ApplyOptions = {
  mode: ReviewMode;
  /** 同じセッション内での再挑戦（もう一度の後） */
  isRetry?: boolean;
};

export function applyReview(
  state: ReviewState,
  rating: ReviewRating,
  today: LocalDate,
  { mode, isRetry = false }: ApplyOptions,
): ReviewOutcome {
  const base: ReviewState = {
    ...state,
    totalReviews: state.totalReviews + 1,
    lastReviewedOn: today,
    lastRating: rating,
  };

  if (isRetry) {
    // 再挑戦は練習として記録するだけ。連続成功・予定は変えない
    return {
      next: base,
      requeueInSession: rating === "again",
      intervalDays: Math.max(0, diffDays(today, base.dueOn)),
    };
  }

  const streak = rating === "got_it" ? state.successStreak + 1 : 0;
  const lapses = rating === "again" ? state.lapses + 1 : state.lapses;
  const mastered = streak >= MASTERY_STREAK;

  let stage: number;
  let dueOn: LocalDate;

  if (mode === "fixed") {
    ({ stage, dueOn } = nextFixed(state.startedOn, state.stage + 1, today));
  } else if (rating === "again") {
    stage = 0;
    dueOn = addDays(today, 1);
  } else if (rating === "close") {
    stage = state.stage;
    dueOn = addDays(today, 1);
  } else {
    stage = Math.min(state.stage + 1, LAST_STAGE + 1);
    const days = stage <= LAST_STAGE ? REVIEW_STAGE_DAYS[stage]! : AFTER_LAST_DAYS;
    dueOn = addDays(today, days);
  }

  return {
    next: { ...base, stage, dueOn, successStreak: streak, lapses, mastered },
    requeueInSession: rating === "again",
    intervalDays: diffDays(today, dueOn),
  };
}

export function isDue(state: ReviewState, today: LocalDate): boolean {
  return state.dueOn <= today;
}

/** 期限到来分を、期限が古い順に並べる（期限超過分も1件ずつ） */
export function dueQueue(states: readonly ReviewState[], today: LocalDate): string[] {
  return states
    .filter((s) => isDue(s, today))
    .sort((a, b) => (a.dueOn === b.dueOn ? a.entryId.localeCompare(b.entryId) : a.dueOn < b.dueOn ? -1 : 1))
    .map((s) => s.entryId);
}

/** 段階の表示用（1〜6回目、以降は「定着期」） */
export function stageLabel(stage: number): string {
  return stage <= LAST_STAGE ? `${stage + 1} / ${REVIEW_STAGE_DAYS.length}回目` : "定着期";
}
