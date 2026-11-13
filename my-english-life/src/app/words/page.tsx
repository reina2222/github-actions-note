import type { Metadata } from "next";

import { WordsScreen } from "@/features/words/words-screen";

export const metadata: Metadata = { title: "単語帳" };

export default function WordsPage() {
  return <WordsScreen />;
}
