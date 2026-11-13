"use client";

import { useSearchParams } from "next/navigation";

import { ReviewScreen } from "./review-screen";

export function ReviewRoute() {
  const entry = useSearchParams().get("entry");
  return entry ? <ReviewScreen key={entry} entryId={entry} /> : <ReviewScreen key="today" />;
}
