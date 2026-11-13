"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, Check, ExternalLink, FileQuestion, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, Chip, EmptyState, LinkButton, LoadingBlock, Notice, PageHeader, SpeakButton, cn } from "@/components/ui";
import { DictionaryNotInstalledError, loadDictRecord } from "@/lib/dictionary/client";
import { dictRecordToEntry, tagLabel } from "@/lib/dictionary/to-entry";
import { eikenLabel, type DictRecord } from "@/lib/dictionary/types";
import { routes } from "@/lib/routes";
import { POS_LABELS } from "@/lib/schemas";
import { useAppTts } from "@/lib/speech/use-app-tts";
import { useLearning } from "@/lib/store/learning-provider";

import { CefrBadge } from "../words/cefr-picker";

export function DictionaryDetailRoute() {
  const w = useSearchParams().get("w") ?? "";
  return <DictionaryDetailScreen key={w} word={w} />;
}

type State = { status: "loading" } | { status: "ready"; rec: DictRecord } | { status: "notfound" } | { status: "error" };

function WordChips({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((w) => (
          <li key={w}>
            <Link href={routes.dictionaryDetail(w)} className="english inline-block rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
              {w}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DictionaryDetailScreen({ word }: { word: string }) {
  const router = useRouter();
  const { snapshot, run } = useLearning();
  const tts = useAppTts();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!word) {
      setState({ status: "notfound" });
      return;
    }
    loadDictRecord(word)
      .then((rec) => alive && setState(rec ? { status: "ready", rec } : { status: "notfound" }))
      .catch((e: unknown) => alive && setState({ status: e instanceof DictionaryNotInstalledError ? "notfound" : "error" }));
    return () => {
      alive = false;
    };
  }, [word]);

  const existing = snapshot?.entries.find((e) => e.headword.trim().toLowerCase() === word.toLowerCase());
  const favorite = snapshot?.dictFavorites.includes(word) ?? false;
  const speak = { speakingText: tts.speakingText, onSpeak: tts.speak, onStop: tts.stop, supported: tts.supported };

  const register = async (rec: DictRecord) => {
    setBusy(true);
    setError(null);
    try {
      const entry = await run((r) => r.addEntry(dictRecordToEntry(rec)));
      router.push(routes.wordDetail(entry.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録できませんでした。");
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={word || "辞書"}
        back={routes.dictionary}
        right={
          state.status === "ready" && (
            <button
              type="button"
              onClick={() => void run((r) => r.toggleDictFavorite(word))}
              aria-pressed={favorite}
              aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"}
              className="flex size-11 items-center justify-center rounded-full hover:bg-primary-soft"
            >
              <Star size={22} className={cn(favorite ? "fill-current text-warning" : "text-ink-subtle")} aria-hidden />
            </button>
          )
        }
      />

      {state.status === "loading" && <LoadingBlock />}
      {state.status === "notfound" && (
        <EmptyState
          icon={FileQuestion}
          title="辞書に見つかりませんでした"
          action={
            <LinkButton href={routes.dictionary} full size="md">
              辞書の検索へ
            </LinkButton>
          }
        />
      )}
      {state.status === "error" && (
        <Notice tone="warning" title="読み込めませんでした">
          インターネットにつながっているか確認して、もう一度開いてください。
        </Notice>
      )}

      {state.status === "ready" && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="english text-3xl font-bold break-words">{state.rec.w}</p>
                {state.rec.ipa && (
                  <p className="mt-1 space-x-3 text-sm text-ink-muted">
                    {state.rec.ipa.us && <span>米 {state.rec.ipa.us}</span>}
                    {state.rec.ipa.uk && <span>英 {state.rec.ipa.uk}</span>}
                    {state.rec.ipa.any && <span>{state.rec.ipa.any}</span>}
                  </p>
                )}
              </div>
              <SpeakButton text={state.rec.w} {...speak} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <CefrBadge level={state.rec.cefr ?? null} />
              {eikenLabel(state.rec.cefr) && <Chip tone="muted">{eikenLabel(state.rec.cefr)}の目安</Chip>}
              {(state.rec.reg ?? []).map((r) => (
                <Chip key={r} tone="warning">
                  {r === "slang" ? "スラングあり" : r === "casual" ? "口語・くだけた表現あり" : r}
                </Chip>
              ))}
            </div>
            {state.rec.cefrSrc && <p className="mt-2 text-xs text-ink-subtle">CEFR: {state.rec.cefrSrc}。英検はCEFRから換算した学習上の目安で、出題を保証するものではありません。</p>}

            <div className="mt-4">
              {existing ? (
                <LinkButton href={routes.wordDetail(existing.id)} variant="secondary" full icon={Check}>
                  登録済み・単語帳で見る
                </LinkButton>
              ) : (
                <Button full icon={Plus} loading={busy} onClick={() => void register(state.rec)}>
                  単語帳に登録する
                </Button>
              )}
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </div>
          </Card>

          {state.rec.caution?.length ? (
            <Notice tone="warning" title="使う場面に注意">
              この語には「{[...new Set(state.rec.caution.map(tagLabel))].join("・")}」とされる意味があります。相手を傷つけたり失礼になったりすることがあります。
            </Notice>
          ) : null}

          {state.rec.pos.map((b, i) => (
            <Card key={`${b.p}-${i}`}>
              <p className="mb-3">
                <Chip>{POS_LABELS[b.p]}</Chip>
              </p>
              {b.ja?.length ? (
                <div className="mb-3">
                  <p className="text-xs font-bold text-ink-subtle">日本語の意味（日本語版Wiktionary）</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-base">
                    {b.ja.map((j) => (
                      <li key={j}>{j}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {b.jaTr?.length ? (
                <div className="mb-3">
                  <p className="text-xs font-bold text-ink-subtle">訳語（英語版Wiktionaryの翻訳表）</p>
                  <p className="mt-1 text-base">{b.jaTr.join("、")}</p>
                </div>
              ) : null}
              {!b.ja?.length && !b.jaTr?.length && <p className="mb-3 rounded-2xl bg-surface-muted p-3 text-sm text-ink-muted">日本語訳は収録されていません。</p>}

              <p className="text-xs font-bold text-ink-subtle">英語の定義</p>
              <ol className="mt-1 space-y-2">
                {b.defs.map((d, k) => (
                  <li key={k} className="text-sm">
                    <p className="english">
                      <span className="mr-1 font-bold text-ink-subtle">{k + 1}.</span>
                      {d.tags?.map((t) => (
                        <Chip key={t} tone="muted" className="mr-1">
                          {tagLabel(t)}
                        </Chip>
                      ))}
                      {d.en}
                    </p>
                    {d.ex && (
                      <div className="mt-1.5 flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
                        <p className="english min-w-0 flex-1 font-bold">{d.ex}</p>
                        <SpeakButton text={d.ex} {...speak} label="例文を読み上げ" />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          ))}

          {(state.rec.syn?.length || state.rec.ant?.length) && (
            <Card className="space-y-3">
              <WordChips title="類義語" items={state.rec.syn} />
              <WordChips title="反意語" items={state.rec.ant} />
            </Card>
          )}

          <p className="flex items-start gap-1.5 text-xs text-ink-subtle">
            <BookOpenText size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              出典:{" "}
              <a className="underline" href={`https://en.wiktionary.org/wiki/${encodeURIComponent(state.rec.w)}`} target="_blank" rel="noreferrer">
                Wiktionary「{state.rec.w}」
                <ExternalLink size={12} className="ml-0.5 inline" aria-hidden />
              </a>
              （CC BY-SA 4.0、kaikki.org 経由。一部を抜き出して形式を変更）。
              <Link className="underline" href="/licenses">
                ライセンスの詳細
              </Link>
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
