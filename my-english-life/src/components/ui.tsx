"use client";

/**
 * 共通 UI 部品（デザインシステム）
 * 角丸カード・大きめのボタン（高さ 48px 以上）・十分な余白を基本とする。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  CircleAlert,
  FlaskConical,
  Info,
  LoaderCircle,
  Square,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { useFocusMode } from "@/lib/focus-mode";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-card hover:bg-primary-strong disabled:bg-line disabled:text-ink-subtle disabled:shadow-none",
  secondary:
    "bg-surface text-primary border border-line hover:bg-primary-soft disabled:text-ink-subtle disabled:bg-surface-muted",
  ghost: "bg-transparent text-primary hover:bg-primary-soft disabled:text-ink-subtle",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft disabled:text-ink-subtle",
};

const sizeClass: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm rounded-xl gap-1.5",
  lg: "min-h-14 px-6 text-base rounded-2xl gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "lg", full = false) {
  return cn(
    "inline-flex items-center justify-center font-bold transition-colors select-none disabled:cursor-not-allowed",
    variantClass[variant],
    sizeClass[size],
    full && "w-full",
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "lg",
  full,
  icon: Icon,
  iconRight: IconRight,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? 20 : 18;
  return (
    <button
      type={type}
      className={cn(buttonClass(variant, size, full), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={iconSize} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden />
      )}
      <span>{children}</span>
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden />}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "lg",
  full,
  icon: Icon,
  iconRight: IconRight,
  children,
  className,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const iconSize = size === "lg" ? 20 : 18;
  return (
    <Link href={href} className={cn(buttonClass(variant, size, full), className)}>
      {Icon && <Icon size={iconSize} aria-hidden />}
      <span>{children}</span>
      {IconRight && <IconRight size={iconSize} aria-hidden />}
    </Link>
  );
}

/* ---------- Card ---------- */

export function Card({
  children,
  className,
  as: Tag = "section",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
  tone?: "default" | "muted" | "success" | "primary";
}) {
  const toneClass = {
    default: "bg-surface border-line",
    muted: "bg-surface-muted border-transparent",
    success: "bg-success-soft border-transparent",
    primary: "bg-primary-soft border-transparent",
  }[tone];
  return <Tag className={cn("rounded-3xl border p-5 shadow-card", toneClass, className)}>{children}</Tag>;
}

export function SectionTitle({
  icon: Icon,
  children,
  action,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        {Icon && <Icon size={20} className="text-primary" aria-hidden />}
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ---------- Chip / Badge ---------- */

export function Chip({
  children,
  tone = "primary",
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "muted" | "warning" | "success" | "danger";
  className?: string;
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    muted: "bg-surface-muted text-ink-muted",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** デモデータであることを明示するバッジ（実データと誤認させないため） */
export function DemoBadge({ label = "デモ" }: { label?: string }) {
  return (
    <Chip tone="warning">
      <FlaskConical size={12} aria-hidden />
      {label}
    </Chip>
  );
}

/* ---------- Notice ---------- */

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "info" ? Info : tone === "warning" ? FlaskConical : CircleAlert;
  const toneClass = {
    info: "bg-primary-soft text-ink",
    warning: "bg-warning-soft text-ink",
    danger: "bg-danger-soft text-ink",
  }[tone];
  const iconClass = { info: "text-primary", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "note"}
      className={cn("flex gap-3 rounded-2xl p-4 text-sm", toneClass, className)}
    >
      <Icon size={20} className={cn("mt-0.5 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div className="text-ink-muted">{children}</div>
      </div>
    </div>
  );
}

/* ---------- PageHeader ---------- */

export function PageHeader({
  title,
  back,
  right,
}: {
  title: string;
  /** 戻り先。true ならブラウザ履歴で戻る */
  back?: string | true;
  right?: ReactNode;
}) {
  const router = useRouter();
  // 集中入力モード中は隠して、入力欄にスペースを譲る
  const focusMode = useFocusMode();
  if (focusMode) return null;
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex min-h-14 items-center gap-1 border-b border-line bg-bg/90 px-2 backdrop-blur">
      {back ? (
        back === true ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
            aria-label="戻る"
          >
            <ChevronLeft size={24} aria-hidden />
          </button>
        ) : (
          <Link
            href={back}
            className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
            aria-label="戻る"
          >
            <ChevronLeft size={24} aria-hidden />
          </Link>
        )
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
      <div className="flex items-center gap-1 pr-2">{right}</div>
    </header>
  );
}

/* ---------- 状態表示 ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon size={28} aria-hidden />
      </div>
      <p className="font-bold">{title}</p>
      {description && <div className="text-sm text-ink-muted">{description}</div>}
      {action && <div className="mt-2 w-full max-w-xs">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-muted", className)} aria-hidden />;
}

export function LoadingBlock({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-28" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}

export function StoreError() {
  return (
    <Notice tone="danger" title="データを読み込めませんでした">
      ブラウザのプライベートモードなどで保存領域が使えない可能性があります。通常モードで開き直してください。
    </Notice>
  );
}

/* ---------- SegmentedControl ---------- */

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon; disabled?: boolean }>;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-muted p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors",
              active ? "bg-surface text-primary shadow-card" : "text-ink-muted hover:text-ink",
              o.disabled && "opacity-50",
            )}
          >
            {Icon && <Icon size={18} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 読み上げボタン ---------- */

export function SpeakButton({
  text,
  speakingText,
  onSpeak,
  onStop,
  supported,
  label = "読み上げ",
}: {
  text: string;
  speakingText: string | null;
  onSpeak: (t: string) => void;
  onStop: () => void;
  supported: boolean;
  label?: string;
}) {
  if (!supported) return null;
  const speaking = speakingText === text;
  return (
    <button
      type="button"
      onClick={() => (speaking ? onStop() : onSpeak(text))}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary hover:bg-lavender"
      aria-label={speaking ? "読み上げを停止" : `${label}: ${text}`}
      aria-pressed={speaking}
    >
      {speaking ? <Square size={16} aria-hidden /> : <Volume2 size={20} aria-hidden />}
    </button>
  );
}

/* ---------- Switch（ON/OFF） ---------- */

export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center gap-3 py-2 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        {description && <span className="block text-xs text-ink-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-ink-subtle/50",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-surface shadow-card transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
      <span className="sr-only">{checked ? "ON" : "OFF"}</span>
    </button>
  );
}
