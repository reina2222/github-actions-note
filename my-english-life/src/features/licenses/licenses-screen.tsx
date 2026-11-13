"use client";

import { BookOpen, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { loadDictMeta } from "@/lib/dictionary/client";
import type { DictMeta } from "@/lib/dictionary/types";

/** 収録辞書の出典（public/dict/meta.json から表示。辞書を作り直すと自動で更新される） */
function DictionarySources() {
  const [meta, setMeta] = useState<DictMeta | null | "none">(null);
  useEffect(() => {
    loadDictMeta().then(setMeta, () => setMeta("none"));
  }, []);
  if (meta === null) return <p className="text-sm text-ink-subtle">読み込み中…</p>;
  if (meta === "none")
    return <p className="text-sm">収録辞書はまだ入っていません。単語帳の内容は、すべてあなたが登録したものです。</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        収録辞書（{meta.count.toLocaleString()}語・{meta.version}作成）は、次のデータを加工して作っています。Wiktionary・Octanove
        由来のデータは CC BY-SA 4.0 で、同じ条件のもと自由に再利用できます。
      </p>
      <ul className="space-y-2">
        {meta.sources.map((s) => (
          <li key={s.name} className="rounded-2xl bg-surface-muted p-3 text-sm">
            <p className="font-bold">
              <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                {s.name}
              </a>
            </p>
            <p className="text-xs text-ink-muted">{s.via}</p>
            <p className="mt-1 text-xs">
              ライセンス:{" "}
              {s.licenseUrl ? (
                <a href={s.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                  {s.license}
                </a>
              ) : (
                s.license
              )}
            </p>
            <p className="text-xs text-ink-muted">用途: {s.use}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-subtle">変更点: {meta.changes}</p>
      <p className="text-xs text-ink-subtle">
        英検のレベルは、CEFR から換算した学習上の目安です（3級=A1、準2級=A2、2級=B1、準1級=B2、1級=C1）。英検の公式な語彙リストではなく、出題を保証するものではありません。
      </p>
    </div>
  );
}

/** データ提供元・ライセンス */
export function LicensesScreen() {
  return (
    <div>
      <PageHeader title="データ提供元・ライセンス" back="/mypage" />
      <div className="space-y-4">
        <Card>
          <SectionTitle icon={BookOpen}>辞書・例文データ</SectionTitle>
          <DictionarySources />
        </Card>
        <Card>
          <SectionTitle icon={Volume2}>音声</SectionTitle>
          <p className="text-sm">
            読み上げと音声入力には、お使いの端末・ブラウザに入っている機能（Web Speech
            API）を使っています。音声データはアプリには含まれていません（Wiktionary の音声ファイルも取り込んでいません）。
          </p>
          <p className="mt-2 text-xs text-ink-subtle">
            一部のブラウザでは、音声入力の音声がブラウザ提供元のサーバーで文字に変換される場合があります。
          </p>
        </Card>
        <Card tone="muted">
          <p className="text-sm">このアプリは AI（OpenAI・Anthropic・Google など）の API を使っていません。</p>
        </Card>
      </div>
    </div>
  );
}
