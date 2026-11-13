#!/usr/bin/env node
/*
 * 収録辞書（public/dict/）を作るスクリプト
 * ------------------------------------------------------------
 * GitHub Actions（.github/workflows/build-dictionary.yml）から実行する想定。
 * パソコンで実行する場合:
 *   node scripts/dict/build-dictionary.mjs --size 1000 \
 *     --en en-raw.jsonl.gz --ja ja-raw.jsonl.gz --freq wordfreq.txt \
 *     --cefrj cefrj.csv --octanove octanove.csv --out public/dict
 *
 * 入力（どれも無料・ライセンス確認済みの公開データ）
 *   --en        kaikki.org の英語版 Wiktionary 抽出データ（JSONL / .gz 可）
 *   --ja        kaikki.org の日本語版 Wiktionary 抽出データ（JSONL / .gz 可。無くても動く）
 *   --freq      頻度順の単語リスト（1行1語。wordfreq から作る）
 *   --cefrj     CEFR-J Wordlist 1.5（CSV）
 *   --octanove  Octanove Vocabulary Profile C1/C2 1.0（CSV）
 */
import { createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { join } from "node:path";

import { buildWord, convertEnRecord, convertJaRecord, orderCandidates, POS_CODE, readCefrTable, shardOf } from "./lib.mjs";

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, "")] = a[i + 1];
  return o;
}

const opt = args();
const SIZE = Number(opt.size ?? 1000);
const OUT = opt.out ?? "public/dict";
for (const k of ["en", "freq", "cefrj", "octanove"]) {
  if (!opt[k] || !existsSync(opt[k])) {
    console.error(`入力ファイルがありません: --${k} ${opt[k] ?? ""}`);
    process.exit(1);
  }
}
if (![1000, 5000, 10000, 15000].includes(SIZE)) console.warn(`注意: 段階外の語数です（${SIZE}）`);

function lines(path) {
  let stream = createReadStream(path);
  if (path.endsWith(".gz")) stream = stream.pipe(createGunzip());
  return createInterface({ input: stream, crlfDelay: Infinity });
}

const EN_RE = /"lang_code":\s*"en"/;
// kaikki のデータは項目名がアルファベット順で、見出し語 "word" が行の最後に来る。
// 行末の "word" だけを先に読み、候補でない語は JSON を解析しない（数百万行あるため）。
const WORD_AT_END = /"word":\s*"((?:[^"\\]|\\.)*)"\s*}\s*$/;
function headword(line) {
  const m = WORD_AT_END.exec(line);
  if (m) {
    try {
      return JSON.parse(`"${m[1]}"`);
    } catch {
      return null;
    }
  }
  return undefined; // 形式が違う行 → 全体を解析して確かめる
}

/* 1. 収録候補の順番を決める */
const cefrj = readCefrTable(readFileSync(opt.cefrj, "utf8"), "CEFR-J Wordlist 1.5");
const octa = readCefrTable(readFileSync(opt.octanove, "utf8"), "Octanove Vocabulary Profile C1/C2 1.0");
const cefr = new Map(cefrj);
for (const [w, v] of octa) if (!cefr.has(w)) cefr.set(w, v); // CEFR-J を優先
const freq = readFileSync(opt.freq, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const order = orderCandidates(freq, cefr);
// 品質の悪い語で枠が埋まらないよう、目標の2.5倍まで候補にしておく
const candidates = new Set(order.slice(0, Math.ceil(SIZE * 2.5) + 2000));
console.log(`候補: ${candidates.size}語（CEFR表: CEFR-J ${cefrj.size}語 / Octanove ${octa.size}語）`);

/* 2. 英語版 Wiktionary を1行ずつ読む（全部はメモリに載せない） */
const en = new Map();
let enLines = 0;
for await (const line of lines(opt.en)) {
  enLines++;
  if (!EN_RE.test(line)) continue;
  const hw = headword(line);
  if (hw === null || (hw !== undefined && !candidates.has(hw))) continue;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    continue;
  }
  if (!candidates.has(rec.word)) continue;
  const part = convertEnRecord(rec);
  if (!part) continue;
  (en.get(part.word) ?? en.set(part.word, []).get(part.word)).push(part);
}
console.log(`英語版: ${enLines.toLocaleString()}行を読み、${en.size}語が使えました`);

/* 3. 日本語版 Wiktionary（任意） */
const ja = new Map();
if (opt.ja && existsSync(opt.ja)) {
  for await (const line of lines(opt.ja)) {
    if (!EN_RE.test(line)) continue;
    const hw = headword(line);
    if (hw === null || (hw !== undefined && !candidates.has(hw))) continue;
    try {
      const rec = JSON.parse(line);
      if (!candidates.has(rec.word)) continue;
      const part = convertJaRecord(rec);
      if (part) (ja.get(part.word) ?? ja.set(part.word, []).get(part.word)).push(part);
    } catch {
      // 壊れた行は飛ばす
    }
  }
  console.log(`日本語版: ${ja.size}語に日本語の語義がありました`);
} else {
  console.log("日本語版 Wiktionary は使いませんでした（--ja 未指定）");
}

/* 4. 順番どおりに SIZE 語まで集める */
const picked = [];
for (const w of order) {
  if (picked.length >= SIZE) break;
  const parts = en.get(w);
  if (!parts?.length) continue;
  picked.push(buildWord(w, parts, ja.get(w) ?? [], cefr.get(w) ?? null));
}

/* 5. 書き出す（index.json = 検索用の一覧、entries/<先頭文字>.json = 詳細） */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "entries"), { recursive: true });
const shards = new Map();
const rows = [];
const stat = { total: picked.length, ja: 0, jaFromJaWiki: 0, jaFromTranslations: 0, cefr: 0, ipa: 0, examples: 0, syn: 0, ant: 0, slang: 0 };
const cefrCount = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, none: 0 };
for (const { record, jaShort } of picked) {
  const s = shardOf(record.w);
  (shards.get(s) ?? shards.set(s, {}).get(s))[record.w] = record;
  rows.push([record.w, record.cefr ?? "", record.pos.map((b) => POS_CODE[b.p]).join(""), jaShort]);
  if (jaShort) stat.ja++;
  if (record.pos.some((b) => b.ja?.length)) stat.jaFromJaWiki++;
  else if (record.pos.some((b) => b.jaTr?.length)) stat.jaFromTranslations++;
  if (record.cefr) stat.cefr++;
  cefrCount[record.cefr ?? "none"]++;
  if (record.ipa) stat.ipa++;
  if (record.pos.some((b) => b.defs.some((d) => d.ex))) stat.examples++;
  if (record.syn?.length) stat.syn++;
  if (record.ant?.length) stat.ant++;
  if (record.reg?.includes("slang") || record.reg?.includes("casual")) stat.slang++;
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
let bytes = 0;
for (const [s, obj] of shards) {
  const json = JSON.stringify(obj);
  bytes += json.length;
  writeFileSync(join(OUT, "entries", `${s}.json`), json);
}
const builtAt = new Date().toISOString();
const meta = {
  version: builtAt.slice(0, 10),
  builtAt,
  count: picked.length,
  target: SIZE,
  shards: [...shards.keys()].sort(),
  stats: stat,
  cefr: cefrCount,
  sources: [
    { name: "Wiktionary（英語版）", via: "kaikki.org / wiktextract", url: "https://en.wiktionary.org/", license: "CC BY-SA 4.0 / GFDL", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", use: "定義・品詞・発音記号・例文（作例のみ）・類義語・反意語・翻訳表の日本語訳・スラング等の表示" },
    ...(opt.ja && existsSync(opt.ja) ? [{ name: "Wiktionary（日本語版）", via: "kaikki.org / wiktextract", url: "https://ja.wiktionary.org/", license: "CC BY-SA 4.0 / GFDL", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", use: "日本語の語義" }] : []),
    { name: "The CEFR-J Wordlist Version 1.5", via: "Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from http://www.cefr-j.org/download.html", url: "https://github.com/openlanguageprofiles/olp-en-cefrj", license: "研究・商用とも無料（出典の明記が条件）。著作権: 東京外国語大学 投野研究室", use: "CEFR A1〜B2" },
    { name: "Octanove Vocabulary Profile C1/C2 1.0", via: "Octanove Labs", url: "https://github.com/openlanguageprofiles/olp-en-cefrj", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", use: "CEFR C1〜C2" },
    { name: "wordfreq", via: "Robyn Speer ほか", url: "https://github.com/rspeer/wordfreq", license: "データ: CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", use: "収録する語の選定（頻度順）。頻度の数値は収録していません" },
  ],
  changes: "元データから、学習に使う項目だけを抜き出して形式を変えています（古語・まれな語義・活用形・固有名詞・引用文・音声は除外）。内容の書き換えや翻訳はしていません。",
};
writeFileSync(join(OUT, "index.json"), JSON.stringify({ v: meta.version, rows }));
writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
writeFileSync(
  join(OUT, "LICENSE.md"),
  `# 収録辞書データのライセンス\n\nこのフォルダ（public/dict/）のデータは、以下のデータを加工して作ったものです。\nWiktionary・Octanove 由来の部分は **CC BY-SA 4.0** で配布します（同じライセンスで自由に再利用できます）。\n\n${meta.sources.map((s) => `- **${s.name}**（${s.via}）\n  - ${s.url}\n  - ライセンス: ${s.license}\n  - 用途: ${s.use}`).join("\n")}\n\n変更点: ${meta.changes}\n`,
);

/* 6. 報告（GitHub Actions の画面に表示される） */
const pct = (n) => (stat.total ? `${((n / stat.total) * 100).toFixed(1)}%` : "-");
const report = `## 辞書データ作成の結果（目標 ${SIZE.toLocaleString()}語）

| 項目 | 語数 | 割合 |
|---|---:|---:|
| 収録語数 | ${stat.total.toLocaleString()} | - |
| 日本語訳あり | ${stat.ja} | ${pct(stat.ja)} |
| └ 日本語版Wiktionaryの語義 | ${stat.jaFromJaWiki} | ${pct(stat.jaFromJaWiki)} |
| └ 英語版の翻訳表のみ | ${stat.jaFromTranslations} | ${pct(stat.jaFromTranslations)} |
| CEFRあり | ${stat.cefr} | ${pct(stat.cefr)} |
| 発音記号あり | ${stat.ipa} | ${pct(stat.ipa)} |
| 例文あり | ${stat.examples} | ${pct(stat.examples)} |
| 類義語あり | ${stat.syn} | ${pct(stat.syn)} |
| 反意語あり | ${stat.ant} | ${pct(stat.ant)} |
| スラング・口語の語義あり | ${stat.slang} | ${pct(stat.slang)} |

CEFR内訳: ${Object.entries(cefrCount).map(([k, v]) => `${k === "none" ? "未設定" : k} ${v}`).join(" / ")}

データ容量: 詳細 ${(bytes / 1024).toFixed(0)}KB（圧縮前）+ 検索用一覧 ${(JSON.stringify(rows).length / 1024).toFixed(0)}KB（圧縮前）
`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, report, { flag: "a" });
writeFileSync(join(OUT, "REPORT.md"), report);
