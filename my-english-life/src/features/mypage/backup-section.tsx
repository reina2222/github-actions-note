"use client";

import Link from "next/link";
import { ChevronRight, Download, FileText, HardDrive, Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button, Card, Notice, SectionTitle } from "@/components/ui";
import { toLocalDate } from "@/lib/dates";
import { ImportError } from "@/lib/store/local-repository";
import { useLearning } from "@/lib/store/learning-provider";

/** ファイルとして保存（iPhone では「ファイル」アプリなどに保存できる） */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** マイページ「データの保存とバックアップ」 */
export function BackupSection() {
  const { repo, run, snapshot } = useLearning();
  const fileId = useId();
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasLegacy, setHasLegacy] = useState(false);

  useEffect(() => {
    void repo?.legacyBackup().then((b) => setHasLegacy(Boolean(b)));
  }, [repo]);

  return (
    <>
      <Card>
        <SectionTitle icon={HardDrive}>データの保存とバックアップ</SectionTitle>
        <div className="space-y-2 text-sm text-ink-muted">
          <p>
            単語帳と学習の記録は、<b className="text-ink">この端末のブラウザの中だけ</b>
            に保存されています（ログイン不要）。
          </p>
          <p>
            ブラウザの「履歴とWebサイトデータを消去」、機種変更、別のブラウザで開いたときなどには、データが見えなくなります。iPhone
            では、しばらく開かないと Safari がデータを消すことがあります。
          </p>
          <p>
            大切なデータは、ときどき<b className="text-ink">バックアップ（JSON ファイル）</b>
            に保存してください。新しい端末では「取り込む」で戻せます。
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <Button
            icon={Download}
            size="md"
            full
            disabled={!repo || busy}
            onClick={async () => {
              if (!repo) return;
              downloadText(`my-english-life-backup-${toLocalDate()}.json`, await repo.exportJson());
              setMessage({ tone: "info", text: `バックアップを保存しました（${snapshot?.entries.length ?? 0}件）。` });
            }}
          >
            バックアップを保存（エクスポート）
          </Button>

          <label
            htmlFor={fileId}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-primary hover:bg-primary-soft"
          >
            <Upload size={18} aria-hidden />
            バックアップを取り込む（インポート）
          </label>
          <input
            id={fileId}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setMessage(null);
              try {
                const text = await file.text();
                const result = await run((r) => r.importJson(text));
                setMessage({
                  tone: "info",
                  text: `${result.added}件を取り込みました。${result.skipped ? `すでにある${result.skipped}件はそのままです。` : ""}`,
                });
              } catch (err) {
                setMessage({
                  tone: "danger",
                  text: err instanceof ImportError ? err.message : "取り込めませんでした。",
                });
              } finally {
                setBusy(false);
              }
            }}
          />
          <p className="text-xs text-ink-subtle">取り込みは「追加」です。今のデータは消えません。</p>

          {hasLegacy && (
            <Button
              variant="secondary"
              size="md"
              full
              icon={FileText}
              onClick={async () => {
                const raw = await repo?.legacyBackup();
                if (raw) downloadText(`my-english-life-v1-backup.json`, raw);
              }}
            >
              旧版（英作文アプリ）のデータを保存
            </Button>
          )}
        </div>
        {message && (
          <Notice tone={message.tone} className="mt-3">
            {message.text}
          </Notice>
        )}
      </Card>

      <Link
        href="/licenses"
        className="flex min-h-14 items-center gap-3 rounded-3xl border border-line bg-surface px-5 shadow-card hover:border-primary"
      >
        <FileText size={20} className="text-primary" aria-hidden />
        <span className="flex-1 font-bold">データ提供元・ライセンス</span>
        <ChevronRight size={20} className="text-ink-subtle" aria-hidden />
      </Link>
    </>
  );
}
