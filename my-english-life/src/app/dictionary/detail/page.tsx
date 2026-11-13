import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingBlock } from "@/components/ui";
import { DictionaryDetailRoute } from "@/features/dictionary/dictionary-detail-screen";

export const metadata: Metadata = { title: "辞書" };

/** /dictionary/detail?w=…（見出し語はクライアントで読む） */
export default function DictionaryDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DictionaryDetailRoute />
    </Suspense>
  );
}
