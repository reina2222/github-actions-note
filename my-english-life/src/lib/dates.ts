/**
 * 日付ユーティリティ
 * 学習日・復習日は「ユーザーのローカル日付」(YYYY-MM-DD) で扱う。
 * 時刻やタイムゾーンのずれで「今日の復習」が前後しないようにするため。
 */

export type LocalDate = string; // "YYYY-MM-DD"

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ユーザーにとっての「今日」。
 * timeZone（例: "Asia/Tokyo"）を渡すとそのタイムゾーンで、省略すると端末の設定で判定する。
 */
export function toLocalDate(date: Date = new Date(), timeZone?: string): LocalDate {
  if (timeZone) {
    try {
      // en-CA は YYYY-MM-DD 形式
      return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
        date,
      );
    } catch {
      // 不正なタイムゾーン名は端末設定にフォールバック
    }
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parse(date: LocalDate): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 暦の上で n 日進めた日付（UTC で計算するので夏時間の影響を受けない） */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parse(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** b - a の日数 */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = parse(a);
  const [by, bm, bd] = parse(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 今日を含む直近7日（月曜始まり）の日付一覧 */
export function weekDays(today: LocalDate): LocalDate[] {
  const [y, m, d] = parse(today);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日
  const mondayOffset = (dow + 6) % 7;
  const monday = addDays(today, -mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatJaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
