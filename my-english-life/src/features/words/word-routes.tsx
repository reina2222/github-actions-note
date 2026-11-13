"use client";

import { useSearchParams } from "next/navigation";
import { FileQuestion } from "lucide-react";

import { EmptyState, LinkButton, LoadingBlock, PageHeader } from "@/components/ui";
import { routes } from "@/lib/routes";
import { useLearning } from "@/lib/store/learning-provider";

import { EntryForm } from "./entry-form";
import { WordDetailScreen } from "./word-detail-screen";

export function WordDetailRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <WordDetailScreen key={id} id={id} />;
}

export function NewWordScreen() {
  return (
    <div>
      <PageHeader title="単語・フレーズを登録" back={routes.words} />
      <EntryForm />
    </div>
  );
}

export function EditWordRoute() {
  const id = useSearchParams().get("id") ?? "";
  const { snapshot } = useLearning();
  const entry = snapshot?.entries.find((e) => e.id === id);
  return (
    <div>
      <PageHeader title="編集" back={entry ? routes.wordDetail(entry.id) : routes.words} />
      {!snapshot ? (
        <LoadingBlock />
      ) : entry ? (
        <EntryForm key={entry.id} initial={entry} />
      ) : (
        <EmptyState
          icon={FileQuestion}
          title="見つかりませんでした"
          action={
            <LinkButton href={routes.words} full size="md">
              単語帳へ
            </LinkButton>
          }
        />
      )}
    </div>
  );
}
