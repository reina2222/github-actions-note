/**
 * 旧版（My English Life 1.x：AI英作文アプリ）の保存データを、2.0 の単語帳に移す。
 *
 * - 旧データ（localStorage "mel:data:v1"）は削除しない。移行前にバックアップを別の場所にも保存する。
 * - 「サンプル」として入れたフレーズ（isSample）は移さない（バックアップには残る）。
 * - 復習の予定・履歴、学習日の記録は引き継ぐ。
 * - 旧データの形が想定と違っても、読める部分だけ移す（落ちない）。
 */
import { z } from "zod";

import { CEFR_LEVELS, guessKind, type Entry, type Example } from "../schemas";
import { REVIEW_RATINGS } from "../srs";
import { DEFAULT_SETTINGS, emptySnapshot, settingsSchema, type Snapshot } from "./types";

export const V1_STORAGE_KEY = "mel:data:v1";
export const V1_BACKUP_KEY = "mel:backup:v1";

const str = z.string().catch("");

const v1PhraseSchema = z.object({
  id: z.string().min(1),
  japanese: str,
  userEnglish: str,
  recommended: z.string().min(1),
  alternatives: z.array(z.object({ english: z.string() }).passthrough()).catch([]),
  explanation: str,
  keyExpressions: z.array(z.object({ expression: z.string(), meaning: str }).passthrough()).catch([]),
  levelVersions: z
    .array(z.object({ level: z.enum(CEFR_LEVELS), english: z.string().min(1), japanese: str }).passthrough())
    .catch([]),
  isSample: z.boolean().catch(false),
  createdAt: z.string().catch(""),
});

const v1ReviewStateSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    return { ...r, stage: r.stage ?? r.intervalStep ?? 0, startedOn: r.startedOn ?? r.lastReviewedOn ?? r.dueOn };
  },
  z.object({
    phraseId: z.string(),
    startedOn: z.string(),
    stage: z.number().int().min(0),
    dueOn: z.string(),
    successStreak: z.number().int().min(0).catch(0),
    lapses: z.number().int().min(0).catch(0),
    totalReviews: z.number().int().min(0).catch(0),
    mastered: z.boolean().catch(false),
    lastReviewedOn: z.string().nullable().catch(null),
  }),
);

const v1LogSchema = z.object({
  id: z.string(),
  phraseId: z.string(),
  rating: z.enum(REVIEW_RATINGS),
  reviewedOn: z.string(),
  createdAt: z.string(),
  source: z.enum(["auto", "manual"]).catch("auto"),
  isRetry: z.boolean().catch(false),
  mode: z.enum(["adaptive", "fixed"]).catch("adaptive"),
});

const v1ActivitySchema = z.object({
  date: z.string(),
  corrections: z.number().catch(0),
  reviews: z.number().catch(0),
  saves: z.number().catch(0),
});

/** 配列の中で読めない要素は捨て、読めるものだけ返す */
function each<S extends z.ZodTypeAny>(schema: S, raw: unknown): Array<z.infer<S>> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const r = schema.safeParse(x);
    return r.success ? [r.data as z.infer<S>] : [];
  });
}

export type MigrationReport = { migrated: number; skippedSamples: number; skippedInvalid: number };

export function migrateV1(rawJson: string, nowIso: string): { snapshot: Snapshot; report: MigrationReport } {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // 壊れていても空として扱う（元データはそのまま残る）
  }

  const rawPhrases = Array.isArray(data.phrases) ? data.phrases : [];
  const phrases = each(v1PhraseSchema, rawPhrases);
  const kept = phrases.filter((p) => !p.isSample);
  const ids = new Set(kept.map((p) => p.id));

  const entries: Entry[] = kept.map((p) => {
    const createdAt = p.createdAt || nowIso;
    const examples: Example[] = p.levelVersions.map((lv, i) => ({
      id: `${p.id}-lv${i}`,
      en: lv.english,
      ja: lv.japanese,
      // 旧版で「このレベル向け」として作られた文なので、そのレベルを引き継ぐ（出典で区別できる）
      cefr: lv.level,
      source: { type: "migrated", dataset: "My English Life 1.x（AI添削のレベル別英文）" },
    }));
    const noteLines = [
      p.userEnglish && `英作文（自分の英文）: ${p.userEnglish}`,
      p.explanation && `解説: ${p.explanation}`,
      ...p.keyExpressions.map((k) => `重要表現: ${k.expression}${k.meaning ? ` = ${k.meaning}` : ""}`),
    ].filter(Boolean);
    return {
      id: p.id,
      kind: guessKind(p.recommended),
      headword: p.recommended.trim().slice(0, 200),
      ipa: "",
      cefr: null,
      senses: [
        {
          id: `${p.id}-s1`,
          pos: null,
          meaningJa: p.japanese.slice(0, 300),
          definitionEn: "",
          examples: examples.slice(0, 30),
          note: "",
        },
      ],
      synonyms: [],
      antonyms: [],
      alternatives: p.alternatives
        .map((a) => a.english)
        .filter(Boolean)
        .slice(0, 30),
      related: p.keyExpressions
        .map((k) => k.expression)
        .filter(Boolean)
        .slice(0, 30),
      registers: [],
      regions: [],
      usageNote: "",
      tags: ["英作文から移行"],
      note: noteLines.join("\n").slice(0, 2000),
      source: { type: "migrated", dataset: "My English Life 1.x" },
      createdAt,
      updatedAt: createdAt,
    };
  });

  const settings = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(data.settings as object) });

  const snapshot: Snapshot = {
    ...emptySnapshot(),
    entries,
    reviewStates: each(v1ReviewStateSchema, data.reviewStates)
      .filter((r) => ids.has(r.phraseId))
      .map(({ phraseId, ...r }) => ({ ...r, entryId: phraseId, lastRating: null })),
    reviewLogs: each(v1LogSchema, data.reviewLogs)
      .filter((l) => ids.has(l.phraseId))
      .map(({ phraseId, ...l }) => ({ ...l, entryId: phraseId })),
    activity: each(v1ActivitySchema, data.activity),
    settings: settings.success ? settings.data : { ...DEFAULT_SETTINGS },
    migratedFromV1At: nowIso,
  };

  return {
    snapshot,
    report: {
      migrated: entries.length,
      skippedSamples: phrases.length - kept.length,
      skippedInvalid: rawPhrases.length - phrases.length,
    },
  };
}
