/** 分割ファイル名（先頭の文字ごと）。scripts/dict/lib.mjs の shardOf と同じ規則 */
export function shardOf(word: string): string {
  const c = word[0]?.toLowerCase() ?? "";
  return /[a-z]/.test(c) ? c : "_";
}
