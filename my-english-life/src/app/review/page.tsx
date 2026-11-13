import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingBlock } from "@/components/ui";
import { ReviewRoute } from "@/features/review/review-route";

export const metadata: Metadata = { title: "復習" };

/**
 * /review          … 今日の復習
 * /review?entry=…  … 単語帳からの手動復習（自動復習の ON/OFF に関係なく利用可能）
 */
export default function ReviewPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ReviewRoute />
    </Suspense>
  );
}
