import type { Metadata } from "next";

import { LicensesScreen } from "@/features/licenses/licenses-screen";

export const metadata: Metadata = { title: "データ提供元・ライセンス" };

export default function LicensesPage() {
  return <LicensesScreen />;
}
