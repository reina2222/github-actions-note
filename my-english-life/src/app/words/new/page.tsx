import type { Metadata } from "next";

import { NewWordScreen } from "@/features/words/word-routes";

export const metadata: Metadata = { title: "単語・フレーズを登録" };

export default function NewWordPage() {
  return <NewWordScreen />;
}
