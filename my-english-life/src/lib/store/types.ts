import { z } from "zod";

import { CEFR_LEVELS, entrySchema, type Entry } from "../schemas";
import { REVIEW_MODES, REVIEW_RATINGS, type ReviewOutcome, type ReviewRating, type ReviewState } from "../srs";

/* ---------- 設定（マイページ） ---------- */

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeSetting = (typeof THEMES)[number];

export const ACCENTS = ["en-US", "en-GB"] as const;
export type Accent = (typeof ACCENTS)[number];

export const settingsSchema = z.object({
  level: z.enum(CEFR_LEVELS),
  weeklyGoalDays: z.number().int().min(1).max(7),
  goalText: z.string().max(100),
  speechRate: z.number().min(0.5).max(1.5),
  accent: z.enum(ACCENTS),
  voiceURI: z.string().max(300).nullable().optional(),
  theme: z.enum(THEMES),
  autoReview: z.boolean().default(true),
  launchNotice: z.boolean().default(true),
  dailyLimit: z.union([z.literal(5), z.literal(10), z.literal(20), z.null()]).default(10),
  reviewMode: z.enum(REVIEW_MODES).default("adaptive"),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  level: "A2",
  weeklyGoalDays: 5,
  goalText: "",
  speechRate: 0.9,
  accent: "en-US",
  theme: "system",
  autoReview: true,
  launchNotice: true,
  dailyLimit: 10,
  reviewMode: "adaptive",
};

/* ---------- 復習 ---------- */

export const reviewStateSchema = z.object({
  entryId: z.string(),
  startedOn: z.string(),
  stage: z.number().int().min(0),
  dueOn: z.string(),
  successStreak: z.number().int().min(0),
  lapses: z.number().int().min(0),
  totalReviews: z.number().int().min(0),
  mastered: z.boolean(),
  lastReviewedOn: z.string().nullable(),
  /** 最後の自己評価 */
  lastRating: z.enum(REVIEW_RATINGS).nullable().default(null),
});

export const reviewLogSchema = z.object({
  /** 回答ごとのID。同じIDは二重登録しない */
  id: z.string(),
  entryId: z.string(),
  rating: z.enum(REVIEW_RATINGS),
  reviewedOn: z.string(),
  createdAt: z.string(),
  source: z.enum(["auto", "manual"]).default("auto"),
  isRetry: z.boolean().default(false),
  mode: z.enum(REVIEW_MODES).default("adaptive"),
});
export type ReviewLog = z.infer<typeof reviewLogSchema>;

export const activityDaySchema = z.object({
  date: z.string(),
  /** 旧版（英作文）の記録。学習日数・連続日数の計算に引き続き使う */
  corrections: z.number().int().min(0).default(0),
  reviews: z.number().int().min(0).default(0),
  saves: z.number().int().min(0).default(0),
});
export type ActivityDay = z.infer<typeof activityDaySchema>;

/* ---------- スナップショット（保存データ全体） ---------- */

export const snapshotSchema = z.object({
  version: z.literal(2),
  entries: z.array(entrySchema),
  reviewStates: z.array(reviewStateSchema),
  reviewLogs: z.array(reviewLogSchema),
  activity: z.array(activityDaySchema),
  settings: settingsSchema,
  /** 旧版（1.x）から移行した日時 */
  migratedFromV1At: z.string().nullable().default(null),
  /** 収録辞書のお気に入り（見出し語） */
  dictFavorites: z.array(z.string().min(1).max(100)).max(5000).default([]),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export function emptySnapshot(): Snapshot {
  return {
    version: 2,
    entries: [],
    reviewStates: [],
    reviewLogs: [],
    activity: [],
    settings: { ...DEFAULT_SETTINGS },
    migratedFromV1At: null,
    dictFavorites: [],
  };
}

/** 新しく登録するときの入力（id・日時・出典はリポジトリが付ける） */
export type EntryInput = Omit<Entry, "id" | "createdAt" | "updatedAt" | "source"> & { source?: Entry["source"] };

export type RecordReviewInput = {
  attemptId: string;
  entryId: string;
  rating: ReviewRating;
  source: "auto" | "manual";
  isRetry: boolean;
};
export type RecordReviewResult = ReviewOutcome & { duplicate: boolean };

export type ImportResult = { added: number; skipped: number };

/**
 * 学習データの保存先。
 * 今はこの端末（localStorage）。ログインなしで使えることを優先する。
 */
export interface LearningRepository {
  readonly kind: "local";
  load(): Promise<Snapshot>;
  addEntry(input: EntryInput): Promise<Entry>;
  updateEntry(id: string, input: EntryInput): Promise<Entry>;
  deleteEntry(id: string): Promise<void>;
  recordReview(input: RecordReviewInput): Promise<RecordReviewResult>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** 収録辞書のお気に入りを切り替える。戻り値は切り替え後の状態 */
  toggleDictFavorite(word: string): Promise<boolean>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<ImportResult>;
  /** 旧版（1.x）のデータのバックアップ（あれば JSON 文字列） */
  legacyBackup(): Promise<string | null>;
  clearAll(): Promise<void>;
}

export type { ReviewState };
