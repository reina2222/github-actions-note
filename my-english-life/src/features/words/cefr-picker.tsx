"use client";

import { cn } from "@/components/ui";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/schemas";

/** CEFR レベルの選択。「未設定」を必ず選べる（根拠なくレベルを付けないため） */
export function CefrPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CefrLevel | null;
  onChange: (v: CefrLevel | null) => void;
}) {
  const options: Array<CefrLevel | null> = [null, ...CEFR_LEVELS];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((lv) => {
        const active = value === lv;
        return (
          <button
            key={lv ?? "none"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(lv)}
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm font-bold",
              active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink-muted",
            )}
          >
            {lv ?? "未設定"}
          </button>
        );
      })}
    </div>
  );
}

export function CefrBadge({ level }: { level: CefrLevel | null }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold",
        level ? "bg-primary-soft text-primary" : "bg-surface-muted text-ink-subtle",
      )}
    >
      {level ?? "レベル未設定"}
    </span>
  );
}
