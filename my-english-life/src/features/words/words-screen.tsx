"use client";

import Link from "next/link";
import { BookOpenText, ChevronRight, NotebookPen, Plus, Search, SearchX, Trophy } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { Chip, EmptyState, LinkButton, LoadingBlock, PageHeader, StoreError, cn } from "@/components/ui";
import { routes } from "@/lib/routes";
import { ENTRY_KIND_LABELS, primaryMeaning, type Entry, type EntryKind } from "@/lib/schemas";
import { useLearning } from "@/lib/store/learning-provider";

import { CefrBadge } from "./cefr-picker";

/** 英語・日本語・定義・例文・タグのどこかに含まれていれば一致 */
export function matchesQuery(e: Entry, q: string): boolean {
  if (!q) return true;
  const hay = [
    e.headword,
    e.ipa,
    e.note,
    ...e.tags,
    ...e.synonyms,
    ...e.antonyms,
    ...e.alternatives,
    ...e.related,
    ...e.senses.flatMap((s) => [s.meaningJa, s.definitionEn, s.note, ...s.examples.flatMap((x) => [x.en, x.ja])]),
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function WordsScreen() {
  const { snapshot, status } = useLearning();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<EntryKind | "all">("all");
  const q = useDeferredValue(query.trim());

  const mastered = useMemo(
    () => new Set(snapshot?.reviewStates.filter((r) => r.mastered).map((r) => r.entryId)),
    [snapshot],
  );
  const filtered = useMemo(
    () => snapshot?.entries.filter((e) => (kind === "all" || e.kind === kind) && matchesQuery(e, q)) ?? [],
    [snapshot, kind, q],
  );

  if (status === "error")
    return (
      <div className="pt-6">
        <StoreError />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="単語帳"
        right={snapshot && <span className="text-sm text-ink-muted">{snapshot.entries.length}件</span>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2">
        <LinkButton href={routes.newWord} full icon={Plus}>
          自分で登録
        </LinkButton>
        <LinkButton href={routes.dictionary} full variant="secondary" icon={BookOpenText}>
          辞書から探す
        </LinkButton>
      </div>

      {!snapshot ? (
        <LoadingBlock />
      ) : snapshot.entries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="まだ登録がありません"
          description="覚えたい英単語やフレーズを登録すると、ここに並びます。日本語訳が分からなくても登録できます。"
        />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={20}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="英語・日本語で検索"
              aria-label="単語帳を検索"
              className="block min-h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-12 text-base placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2" role="radiogroup" aria-label="種類で絞り込み">
            {(["all", "word", "phrase"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-bold",
                  kind === k ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink-muted",
                )}
              >
                {k === "all" ? "すべて" : ENTRY_KIND_LABELS[k]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title="見つかりませんでした" description="別のことばで検索してみてください。" />
          ) : (
            <ul className="space-y-2">
              {filtered.map((e) => {
                const meaning = primaryMeaning(e);
                return (
                  <li key={e.id}>
                    <Link
                      href={routes.wordDetail(e.id)}
                      className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card hover:border-primary"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="english truncate text-lg font-bold">{e.headword}</p>
                        <p className={cn("truncate text-sm", meaning ? "text-ink-muted" : "text-ink-subtle")}>
                          {meaning || "意味は未登録"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Chip tone="muted">{ENTRY_KIND_LABELS[e.kind]}</Chip>
                          {e.cefr && <CefrBadge level={e.cefr} />}
                          {e.senses.length > 1 && <Chip tone="muted">{e.senses.length}つの意味</Chip>}
                          {mastered.has(e.id) && (
                            <Chip tone="success">
                              <Trophy size={12} aria-hidden />
                              習得済み
                            </Chip>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={20} className="shrink-0 text-ink-subtle" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
