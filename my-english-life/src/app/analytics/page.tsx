import type { Metadata } from "next";

import { AnalyticsScreen } from "@/features/analytics/analytics-screen";

export const metadata: Metadata = { title: "学習記録" };

export default function AnalyticsPage() {
  return <AnalyticsScreen />;
}
