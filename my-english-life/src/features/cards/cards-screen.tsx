"use client";

import { Layers, RotateCcw } from "lucide-react";

import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

/** カード学習（フラッシュカード）は Phase 2 で実装予定 */
export function CardsScreen() {
  return (
    <div>
      <PageHeader title="カード学習" />
      <EmptyState
        icon={Layers}
        title="カード学習は準備中です"
        description="英語→日本語・日本語→英語のフラッシュカードを、次の段階（Phase 2）で追加します。今は「復習」タブで、登録した単語を思い出す練習ができます。"
        action={
          <LinkButton href="/review" full size="md" icon={RotateCcw}>
            今日の復習へ
          </LinkButton>
        }
      />
    </div>
  );
}
