import type { Metadata } from "next";

import { DictionaryScreen } from "@/features/dictionary/dictionary-screen";

export const metadata: Metadata = { title: "辞書から探す" };

export default function DictionaryPage() {
  return <DictionaryScreen />;
}
