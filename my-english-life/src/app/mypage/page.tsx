import type { Metadata } from "next";

import { MyPageScreen } from "@/features/mypage/mypage-screen";

export const metadata: Metadata = { title: "マイページ" };

export default function MyPage() {
  return <MyPageScreen />;
}
