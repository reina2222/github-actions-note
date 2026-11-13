"use client";

import { useRouter } from "next/navigation";
import { FileQuestion, Pencil, RotateCcw, Trash2, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Button,
  Card,
  Chip,
  EmptyState,
  LinkButton,
  LoadingBlock,
  Notice,
  PageHeader,
  SpeakButton,
  StoreError,
  cn,
} from "@/components/ui";
import { formatJaDate, toLocalDate } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { CEFR_LEVELS, ENTRY_KIND_LABELS, POS_LABELS, type CefrLevel, type Entry, type Example } from "@/lib/schemas";
import { useAppTts } from "@/lib/speech/use-app-tts";
import { MASTERY_STREAK, REVIEW_RATING_LABELS, stageLabel } from "@/lib/srs";
import { useLearning } from "@/lib/store/learning-provider";

import { CefrBadge } from "./cefr-picker";

const TABS = [
  { id: "meaning", label: "意味・発音" },
  { id: "examples", label: "CEFR例文" },
  { id: "synonyms", label: "類義語・対義語" },
  { id: "native", label: "ネイティブ表現" },
  { id: "history", label: "学習履歴" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Speak = ReturnType<typeof useAppTts>;

function speakProps(tts: Speak) {
  return { speakingText: tts.speakingText, onSpeak: tts.speak, onStop: tts.stop, supported: tts.supported };
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface-muted p-4 text-sm text-ink-muted">{children}</p>;
}

function WordList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-subtle">未登録</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((w) => (
            <li key={w} className="english rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExampleItem({ ex, tts }: { ex: Example; tts: Speak }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-surface-muted p-3">
      <div className="min-w-0 flex-1">
        <p className="english font-bold">{ex.en}</p>
        <p className={cn("mt-0.5 text-sm", ex.ja ? "text-ink-muted" : "text-ink-subtle")}>
          {ex.ja || "日本語訳は未登録"}
        </p>
      </div>
      <SpeakButton text={ex.en} {...speakProps(tts)} />
    </li>
  );
}

function MeaningTab({ entry, tts }: { entry: Entry; tts: Speak }) {
  return (
    <div className="space-y-3">
      {entry.senses.map((s, i) => (
        <Card key={s.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {entry.senses.length > 1 && <span className="text-sm font-bold text-primary">語義 {i + 1}</span>}
            {s.pos && <Chip tone="muted">{POS_LABELS[s.pos]}</Chip>}
          </div>
          <p className={cn("text-lg font-bold", !s.meaningJa && "text-ink-subtle")}>
            {s.meaningJa || "日本語の意味は未登録"}
          </p>
          {s.definitionEn && <p className="english text-sm text-ink-muted">{s.definitionEn}</p>}
          {s.examples.length > 0 && (
            <ul className="space-y-2 pt-1">
              {s.examples.map((ex) => (
                <ExampleItem key={ex.id} ex={ex} tts={tts} />
              ))}
            </ul>
          )}
          {s.note && <p className="whitespace-pre-wrap text-sm text-ink-muted">{s.note}</p>}
        </Card>
      ))}
      {entry.note && (
        <Card tone="muted">
          <p className="mb-1 text-xs font-bold text-ink-muted">メモ</p>
          <p className="whitespace-pre-wrap text-sm">{entry.note}</p>
        </Card>
      )}
    </div>
  );
}

function ExamplesTab({ entry, tts }: { entry: Entry; tts: Speak }) {
  const all = entry.senses.flatMap((s) => s.examples);
  const keys = [...CEFR_LEVELS, "none"] as const;
  const count = (k: (typeof keys)[number]) => all.filter((e) => (k === "none" ? e.cefr === null : e.cefr === k)).length;
  const firstWith = keys.find((k) => count(k) > 0) ?? "none";
  const [level, setLevel] = useState<CefrLevel | "none">(firstWith);
  const shown = all.filter((e) => (level === "none" ? e.cefr === null : e.cefr === level));

  if (all.length === 0) return <Empty>例文はまだありません。「編集」から例文とレベルを追加できます。</Empty>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="例文のCEFRレベル">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={level === k}
            onClick={() => setLevel(k)}
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm font-bold",
              level === k ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink-muted",
              count(k) === 0 && level !== k && "opacity-50",
            )}
          >
            {k === "none" ? "レベル未設定" : k}
            <span className="ml-1 text-xs font-normal">{count(k)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty>このレベルの例文はまだありません。「編集」から追加できます。</Empty>
      ) : (
        <ul className="space-y-2">
          {shown.map((ex) => (
            <ExampleItem key={ex.id} ex={ex} tts={tts} />
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-subtle">
        レベルは根拠があるものだけ設定しています。分からない例文は「レベル未設定」に入ります。
      </p>
    </div>
  );
}

function NativeTab({ entry }: { entry: Entry }) {
  const has = entry.alternatives.length || entry.registers.length || entry.regions.length || entry.usageNote;
  if (!has)
    return (
      <Empty>
        ネイティブ表現（口語・スラング・省略表現など）はまだ登録されていません。言い換えは「編集」から追加できます。
      </Empty>
    );
  return (
    <Card className="space-y-4">
      <WordList title="自然な言い換え（Alternatives）" items={entry.alternatives} />
      {entry.usageNote && (
        <div>
          <p className="mb-1 text-sm font-bold">使うときの注意</p>
          <p className="whitespace-pre-wrap text-sm">{entry.usageNote}</p>
        </div>
      )}
    </Card>
  );
}

function HistoryTab({ entry }: { entry: Entry }) {
  const { snapshot } = useLearning();
  const state = snapshot?.reviewStates.find((r) => r.entryId === entry.id);
  const logs = (snapshot?.reviewLogs ?? [])
    .filter((l) => l.entryId === entry.id)
    .slice(-10)
    .reverse();
  const today = toLocalDate();
  if (!state) return <Empty>復習の記録はまだありません。</Empty>;
  const cells: Array<[string, ReactNode]> = [
    ["復習の段階", stageLabel(state.stage)],
    ["次の復習", state.dueOn <= today ? "今日" : state.dueOn.slice(5).replace("-", "/")],
    ["最後の復習", state.lastReviewedOn ? state.lastReviewedOn.slice(5).replace("-", "/") : "まだ"],
    ["最後の自己評価", state.lastRating ? REVIEW_RATING_LABELS[state.lastRating] : "まだ"],
    ["復習回数", `${state.totalReviews}回`],
    ["連続「覚えた」", `${state.successStreak} / ${MASTERY_STREAK}`],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 text-center text-sm">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface-muted p-3">
            <dt className="text-xs text-ink-muted">{k}</dt>
            <dd className="font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-subtle">「覚えた」が{MASTERY_STREAK}回続くと「習得済み」になります。</p>
      {logs.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex justify-between px-4 py-2">
              <span>{l.reviewedOn.replace(/-/g, "/")}</span>
              <span className="font-bold">
                {REVIEW_RATING_LABELS[l.rating]}
                {l.isRetry && <span className="ml-1 text-xs font-normal text-ink-subtle">（再挑戦）</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <LinkButton href={routes.manualReview(entry.id)} full size="md" variant="secondary" icon={RotateCcw}>
        今すぐ復習する
      </LinkButton>
    </div>
  );
}

export function WordDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { snapshot, status, run } = useLearning();
  const tts = useAppTts();
  const [tab, setTab] = useState<TabId>("meaning");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "error")
    return (
      <div className="pt-6">
        <StoreError />
      </div>
    );
  if (!snapshot)
    return (
      <div>
        <PageHeader title="単語" back={routes.words} />
        <LoadingBlock />
      </div>
    );

  const entry = snapshot.entries.find((e) => e.id === id);
  if (!entry)
    return (
      <div>
        <PageHeader title="単語" back={routes.words} />
        <EmptyState
          icon={FileQuestion}
          title="見つかりませんでした"
          description="削除されたか、別の端末で登録された項目の可能性があります。"
          action={
            <LinkButton href={routes.words} full size="md">
              単語帳へ
            </LinkButton>
          }
        />
      </div>
    );

  const mastered = snapshot.reviewStates.find((r) => r.entryId === id)?.mastered;

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await run((r) => r.deleteEntry(id));
      router.replace(routes.words);
    } catch {
      setError("削除できませんでした。");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={ENTRY_KIND_LABELS[entry.kind]}
        back={routes.words}
        right={
          <LinkButton href={routes.wordEdit(entry.id)} size="md" variant="ghost" icon={Pencil}>
            編集
          </LinkButton>
        }
      />

      <div className="space-y-4">
        <section className="rounded-3xl bg-gradient-to-br from-lavender via-primary-soft to-surface p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="english break-words text-3xl font-bold">{entry.headword}</h2>
              {entry.ipa && <p className="english mt-1 text-ink-muted">{entry.ipa}</p>}
            </div>
            <SpeakButton text={entry.headword} {...speakProps(tts)} label={`${entry.headword} を読み上げ`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">単語の難しさ</span>
            <CefrBadge level={entry.cefr} />
            {mastered && (
              <Chip tone="success">
                <Trophy size={12} aria-hidden />
                習得済み
              </Chip>
            )}
            {entry.tags.map((t) => (
              <Chip key={t} tone="muted">
                #{t}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-subtle">登録日 {formatJaDate(entry.createdAt)}</p>
        </section>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="詳細">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold",
                tab === t.id ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === "meaning" && <MeaningTab entry={entry} tts={tts} />}
          {tab === "examples" && <ExamplesTab entry={entry} tts={tts} />}
          {tab === "synonyms" && (
            <Card className="space-y-4">
              <WordList title="類義語（Synonyms）" items={entry.synonyms} />
              <WordList title="対義語（Antonyms）" items={entry.antonyms} />
              <WordList title="関連表現（Related）" items={entry.related} />
            </Card>
          )}
          {tab === "native" && <NativeTab entry={entry} />}
          {tab === "history" && <HistoryTab entry={entry} />}
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        {confirming ? (
          <Card className="border-danger">
            <p className="font-bold">「{entry.headword}」を削除しますか？</p>
            <p className="mt-1 text-sm text-ink-muted">復習の記録も一緒に削除され、元に戻せません。</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" onClick={() => setConfirming(false)} disabled={deleting}>
                やめる
              </Button>
              <Button variant="danger" size="md" icon={Trash2} onClick={remove} loading={deleting}>
                削除する
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="danger" size="md" full icon={Trash2} onClick={() => setConfirming(true)}>
            この項目を削除
          </Button>
        )}
      </div>
    </div>
  );
}
