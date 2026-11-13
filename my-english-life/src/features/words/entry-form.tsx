"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { EnglishAnswerInput } from "@/components/english-answer-input";
import { Button, Card, Notice, SegmentedControl, cn } from "@/components/ui";
import { routes } from "@/lib/routes";
import {
  ENTRY_KIND_LABELS,
  PARTS_OF_SPEECH,
  POS_LABELS,
  guessKind,
  splitList,
  type CefrLevel,
  type Entry,
  type EntryKind,
  type InputMethod,
  type PartOfSpeech,
} from "@/lib/schemas";
import { createId } from "@/lib/store/local-repository";
import { useLearning } from "@/lib/store/learning-provider";
import type { EntryInput } from "@/lib/store/types";

import { CefrPicker } from "./cefr-picker";

type ExampleDraft = {
  id: string;
  en: string;
  ja: string;
  cefr: CefrLevel | null;
  source?: Entry["senses"][number]["examples"][number]["source"];
};
type SenseDraft = {
  id: string;
  pos: PartOfSpeech | null;
  meaningJa: string;
  definitionEn: string;
  note: string;
  examples: ExampleDraft[];
};

const newSense = (): SenseDraft => ({
  id: createId(),
  pos: null,
  meaningJa: "",
  definitionEn: "",
  note: "",
  examples: [],
});

const inputClass =
  "block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold">{label}</p>
      {children}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/**
 * 単語・フレーズの登録／編集フォーム
 * 英語以外はすべて任意（日本語訳が分からなくても登録できる）。
 */
export function EntryForm({ initial }: { initial?: Entry }) {
  const router = useRouter();
  const { snapshot, run } = useLearning();
  const formId = useId();

  const [headword, setHeadword] = useState(initial?.headword ?? "");
  const [method, setMethod] = useState<InputMethod>("text");
  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? "word");
  const [kindTouched, setKindTouched] = useState(Boolean(initial));
  const [ipa, setIpa] = useState(initial?.ipa ?? "");
  const [cefr, setCefr] = useState<CefrLevel | null>(initial?.cefr ?? null);
  const [senses, setSenses] = useState<SenseDraft[]>(
    initial?.senses.map((s) => ({ ...s, examples: s.examples.map((e) => ({ ...e })) })) ?? [newSense()],
  );
  const [showMore, setShowMore] = useState(
    Boolean(
      initial &&
      (initial.synonyms.length ||
        initial.antonyms.length ||
        initial.alternatives.length ||
        initial.related.length ||
        initial.tags.length ||
        initial.note),
    ),
  );
  const [synonyms, setSynonyms] = useState(initial?.synonyms.join(", ") ?? "");
  const [antonyms, setAntonyms] = useState(initial?.antonyms.join(", ") ?? "");
  const [alternatives, setAlternatives] = useState(initial?.alternatives.join(", ") ?? "");
  const [related, setRelated] = useState(initial?.related.join(", ") ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveKind = kindTouched ? kind : guessKind(headword || "x");
  const trimmed = headword.trim();
  const duplicate = trimmed
    ? snapshot?.entries.find((e) => e.id !== initial?.id && e.headword.toLowerCase() === trimmed.toLowerCase())
    : undefined;

  const updateSense = (id: string, patch: Partial<SenseDraft>) =>
    setSenses((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const updateExample = (senseId: string, exId: string, patch: Partial<ExampleDraft>) =>
    setSenses((ss) =>
      ss.map((s) =>
        s.id === senseId ? { ...s, examples: s.examples.map((e) => (e.id === exId ? { ...e, ...patch } : e)) } : s,
      ),
    );

  async function save() {
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    const input: EntryInput = {
      kind: effectiveKind,
      headword: trimmed,
      ipa: ipa.trim(),
      cefr,
      senses: senses.map((s) => ({
        id: s.id,
        pos: s.pos,
        meaningJa: s.meaningJa.trim(),
        definitionEn: s.definitionEn.trim(),
        note: s.note.trim(),
        examples: s.examples
          .filter((e) => e.en.trim())
          .map((e) => ({
            id: e.id,
            en: e.en.trim(),
            ja: e.ja.trim(),
            cefr: e.cefr,
            source: e.source ?? { type: "user" },
          })),
      })),
      synonyms: splitList(synonyms),
      antonyms: splitList(antonyms),
      alternatives: splitList(alternatives),
      related: splitList(related),
      registers: initial?.registers ?? [],
      regions: initial?.regions ?? [],
      usageNote: initial?.usageNote ?? "",
      tags: splitList(tags),
      note: note.trim(),
      source: initial?.source,
    };
    try {
      const saved = await run((r) => (initial ? r.updateEntry(initial.id, input) : r.addEntry(input)));
      router.replace(routes.wordDetail(saved.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
      setSaving(false);
    }
  }

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <EnglishAnswerInput
        value={headword}
        onChange={(v) => setHeadword(v.replace(/\s*\n\s*/g, " "))}
        method={method}
        onMethodChange={setMethod}
        label="英単語・英語フレーズ（必須）"
        placeholder="例）delighted / Sounds good!"
      />

      {duplicate && (
        <Notice tone="info" title="同じ英語がすでに登録されています">
          別の意味を覚えたいときは、
          <Link href={routes.wordEdit(duplicate.id)} className="font-bold text-primary underline">
            登録済みの「{duplicate.headword}」に語義を追加
          </Link>
          することもできます。このまま別の項目として登録することもできます。
        </Notice>
      )}

      <Field label="種類">
        <SegmentedControl<EntryKind>
          label="種類"
          value={effectiveKind}
          onChange={(k) => {
            setKind(k);
            setKindTouched(true);
          }}
          options={[
            { value: "word", label: ENTRY_KIND_LABELS.word },
            { value: "phrase", label: ENTRY_KIND_LABELS.phrase },
          ]}
        />
      </Field>

      {senses.map((s, i) => (
        <Card key={s.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">語義 {senses.length > 1 ? i + 1 : ""}</h2>
            {senses.length > 1 && (
              <button
                type="button"
                onClick={() => setSenses((ss) => ss.filter((x) => x.id !== s.id))}
                className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-danger hover:bg-danger-soft"
              >
                <Trash2 size={16} aria-hidden />
                この語義を削除
              </button>
            )}
          </div>
          <Field label="日本語の意味" hint="分からなければ空欄のままで大丈夫です">
            <input
              value={s.meaningJa}
              maxLength={300}
              onChange={(e) => updateSense(s.id, { meaningJa: e.target.value })}
              placeholder="例）とても喜んで"
              className={inputClass}
            />
          </Field>
          <Field label="品詞">
            <select
              value={s.pos ?? ""}
              onChange={(e) => updateSense(s.id, { pos: (e.target.value || null) as PartOfSpeech | null })}
              className={inputClass}
            >
              <option value="">未設定</option>
              {PARTS_OF_SPEECH.map((p) => (
                <option key={p} value={p}>
                  {POS_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="英語の定義（任意）">
            <input
              value={s.definitionEn}
              maxLength={500}
              lang="en"
              onChange={(e) => updateSense(s.id, { definitionEn: e.target.value })}
              placeholder="e.g. very pleased"
              className={cn(inputClass, "english")}
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-bold">例文（任意）</p>
            {s.examples.map((ex, j) => (
              <div key={ex.id} className="space-y-2 rounded-2xl bg-surface-muted p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted">例文 {j + 1}</span>
                  <button
                    type="button"
                    aria-label={`例文${j + 1}を削除`}
                    onClick={() => updateSense(s.id, { examples: s.examples.filter((x) => x.id !== ex.id) })}
                    className="flex size-9 items-center justify-center rounded-full text-ink-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <input
                  value={ex.en}
                  maxLength={500}
                  lang="en"
                  onChange={(e) => updateExample(s.id, ex.id, { en: e.target.value })}
                  placeholder="英語の例文"
                  aria-label="英語の例文"
                  className={cn(inputClass, "english")}
                />
                <input
                  value={ex.ja}
                  maxLength={500}
                  onChange={(e) => updateExample(s.id, ex.id, { ja: e.target.value })}
                  placeholder="日本語訳（任意）"
                  aria-label="日本語訳"
                  className={inputClass}
                />
                <p className="text-xs font-bold text-ink-muted">この例文の難しさ（分からなければ未設定）</p>
                <CefrPicker
                  label="例文のCEFRレベル"
                  value={ex.cefr}
                  onChange={(cefr) => updateExample(s.id, ex.id, { cefr })}
                />
              </div>
            ))}
            <Button
              variant="secondary"
              size="md"
              icon={Plus}
              onClick={() =>
                updateSense(s.id, { examples: [...s.examples, { id: createId(), en: "", ja: "", cefr: null }] })
              }
            >
              例文を追加
            </Button>
          </div>

          <Field label="メモ（任意）">
            <textarea
              value={s.note}
              maxLength={1000}
              rows={2}
              onChange={(e) => updateSense(s.id, { note: e.target.value })}
              placeholder="使い方や覚え方など"
              className={cn(inputClass, "resize-none")}
            />
          </Field>
        </Card>
      ))}

      <Button variant="secondary" full icon={Plus} onClick={() => setSenses((ss) => [...ss, newSense()])}>
        別の意味（語義）を追加
      </Button>

      <Field label="発音記号（IPA・任意）">
        <input
          value={ipa}
          maxLength={100}
          onChange={(e) => setIpa(e.target.value)}
          placeholder="例）/dɪˈlaɪtɪd/"
          className={cn(inputClass, "english")}
        />
      </Field>

      <Field label="単語の難しさ（CEFR）" hint="単語そのものの難しさです。例文の難しさとは別に設定します。">
        <CefrPicker label="単語のCEFRレベル" value={cefr} onChange={setCefr} />
      </Field>

      <div className="rounded-2xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-bold"
        >
          <span className="flex-1">もっと詳しく（類義語・対義語・タグなど）</span>
          <ChevronDown
            size={20}
            className={cn("text-ink-subtle transition-transform", showMore && "rotate-180")}
            aria-hidden
          />
        </button>
        {showMore && (
          <div className="space-y-4 border-t border-line p-4">
            <p className="text-xs text-ink-subtle">複数あるときは「,（カンマ）」か「、」で区切ってください。</p>
            {(
              [
                ["類義語（Synonyms）", synonyms, setSynonyms, "glad, pleased"],
                ["対義語（Antonyms）", antonyms, setAntonyms, "unhappy, sad"],
                ["自然な言い換え（Alternatives）", alternatives, setAlternatives, "Sounds good!"],
                ["関連表現（Related）", related, setRelated, "be delighted to ~"],
              ] as const
            ).map(([label, value, setter, ph]) => (
              <Field key={label} label={label}>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={`例）${ph}`}
                  lang="en"
                  className={cn(inputClass, "english")}
                />
              </Field>
            ))}
            <Field label="タグ">
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例）旅行, 仕事"
                className={inputClass}
              />
            </Field>
            <Field label="メモ">
              <textarea
                value={note}
                maxLength={2000}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                className={cn(inputClass, "resize-none")}
              />
            </Field>
          </div>
        )}
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="sticky bottom-above-nav z-10 -mx-4 bg-gradient-to-t from-bg from-60% to-transparent px-4 pt-5 pb-3">
        <Button type="submit" full icon={Save} disabled={!trimmed} loading={saving}>
          {initial ? "変更を保存" : "単語帳に登録"}
        </Button>
        {!trimmed && <p className="mt-2 text-center text-xs text-ink-subtle">英語を入力すると登録できます</p>}
      </div>
    </form>
  );
}
