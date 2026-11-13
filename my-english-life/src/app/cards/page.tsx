import type { Metadata } from "next";

import { CardsScreen } from "@/features/cards/cards-screen";

export const metadata: Metadata = { title: "カード学習" };

export default function CardsPage() {
  return <CardsScreen />;
}
