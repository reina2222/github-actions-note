import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingBlock } from "@/components/ui";
import { EditWordRoute } from "@/features/words/word-routes";

export const metadata: Metadata = { title: "編集" };

export default function EditWordPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <EditWordRoute />
    </Suspense>
  );
}
