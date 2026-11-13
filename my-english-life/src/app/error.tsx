"use client";

import { Button } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <p className="font-bold">画面の表示中に問題が発生しました</p>
      <p className="text-sm text-ink-muted">もう一度お試しください。解決しない場合はページを再読み込みしてください。</p>
      <Button size="md" onClick={reset}>
        もう一度試す
      </Button>
    </div>
  );
}
