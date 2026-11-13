import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingBlock } from "@/components/ui";
import { WordDetailRoute } from "@/features/words/word-routes";

export const metadata: Metadata = { title: "単語" };

/** /words/detail?id=…（オフラインでも開けるよう、id はクライアントで読む） */
export default function WordDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <WordDetailRoute />
    </Suspense>
  );
}
