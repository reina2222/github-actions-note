import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <p className="font-bold">ページが見つかりませんでした</p>
      <LinkButton href="/" size="md">
        ホームへ戻る
      </LinkButton>
    </div>
  );
}
