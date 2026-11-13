"use client";

import { WifiOff } from "lucide-react";

import { EmptyState, LinkButton } from "@/components/ui";

export function OfflineScreen() {
  return (
    <div className="pt-10">
      <EmptyState
        icon={WifiOff}
        title="オフラインです"
        description="この画面はまだ保存されていません。インターネットにつながったら、もう一度開いてください。"
        action={
          <div className="grid gap-2">
            <LinkButton href="/review" full size="md">
              今日の復習
            </LinkButton>
            <LinkButton href="/words" full size="md" variant="secondary">
              単語帳
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
