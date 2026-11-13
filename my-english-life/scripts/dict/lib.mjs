/*
 * 辞書データ作成の「中身」の処理（ネットにつながずにテストできるよう、入出力から分けてある）
 *
 * 方針（仕様書より）
 *   - 元データに無い項目は空欄。意味・発音・例文・レベルを作らない。
 *   - CEFR は CEFR-J / Octanove の表に載っている語だけ。載っていなければ null（＝レベル未設定）。
 *   - 例文は Wiktionary の「作例（usage example）」だけ。本や新聞からの引用文（quotation）は
 *     別の著作権があるため取り込まない。
 *   - 音声ファイルは取り込まない（ファイルごとにライセンスが違うため）。読み上げは端末の音声を使う。
 */

export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Wiktionary の品詞 → アプリの品詞。null は取り込まない（固有名詞・接頭辞・記号など） */
const POS_MAP = {
  noun: "noun",
  verb: "verb",
  adj: "adjective",
  adv: "adverb",
  pron: "pronoun",
  prep: "preposition",
  conj: "conjunction",
  intj: "interjection",
  det: "determiner",
  article: "determiner",
  num: "other",
  particle: "other",
  contraction: "other",
  phrase: "phrase",
  prep_phrase: "phrase",
  proverb: "idiom",
};
export function mapPos(pos) {
  return POS_MAP[pos] ?? null;
}

/** 品詞を1文字で（検索インデックスを小さくするため） */
export const POS_CODE = {
  noun: "n",
  verb: "v",
  adjective: "a",
  adverb: "r",
  pronoun: "p",
  preposition: "e",
  conjunction: "c",
  interjection: "i",
  determiner: "d",
  phrase: "h",
  idiom: "m",
  other: "o",
};

const SKIP_SENSE_TAGS = new Set(["obsolete", "archaic", "misspelling", "nonstandard-spelling", "rare"]);
const REGISTER_TAGS = {
  slang: "slang",
  colloquial: "casual",
  informal: "casual",
  "Internet": "slang",
};
/** 注意が必要な語（使用場面の注意として表示する） */
const CAUTION_TAGS = new Set(["vulgar", "offensive", "derogatory", "pejorative", "ethnic", "slur"]);
const REGION_TAGS = {
  US: "us",
  "General-American": "us",
  UK: "uk",
  British: "uk",
  "Received-Pronunciation": "uk",
  Ireland: "ie",
  Irish: "ie",
  Australia: "au",
  Australian: "au",
};

const clean = (s, max) => {
  if (typeof s !== "string") return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? "" : t; // 長すぎるものは途中で切らずに入れない（意味が変わるため）
};

const isWordToken = (w) => typeof w === "string" && /^[A-Za-z][A-Za-z' -]{0,40}$/.test(w);

/** 発音記号: アメリカ・イギリスを優先して最大2つ */
export function pickIpa(sounds) {
  const out = {};
  for (const s of sounds ?? []) {
    if (typeof s?.ipa !== "string") continue;
    const tags = s.tags ?? [];
    const ipa = s.ipa.trim();
    if (!ipa || ipa.length > 60) continue;
    if (!out.us && tags.some((t) => t === "US" || t === "General-American")) out.us = ipa;
    else if (!out.uk && tags.some((t) => t === "UK" || t === "Received-Pronunciation")) out.uk = ipa;
    else if (!out.any) out.any = ipa;
  }
  const result = {};
  if (out.us) result.us = out.us;
  if (out.uk) result.uk = out.uk;
  if (!out.us && !out.uk && out.any) result.any = out.any;
  return result;
}

function relWords(list) {
  return (list ?? []).map((x) => x?.word).filter(isWordToken);
}

/**
 * 英語版 Wiktionary（kaikki.org）の1行（1品詞ぶん）を、アプリ用の小さな形に変える。
 * 取り込めない行（固有名詞・活用形だけの行など）は null。
 */
export function convertEnRecord(rec) {
  if (!rec || rec.lang_code !== "en" || typeof rec.word !== "string") return null;
  const pos = mapPos(rec.pos);
  if (!pos) return null;

  const defs = [];
  const registers = new Set();
  const regions = new Set();
  const cautions = new Set();
  const syn = relWords(rec.synonyms);
  const ant = relWords(rec.antonyms);
  let lemmaSenses = 0;

  for (const s of rec.senses ?? []) {
    // 活用形・別つづりだけの語義（went → go など）は見出し語として取り込まない
    if (s.form_of || s.alt_of) continue;
    lemmaSenses++;
    const tags = s.tags ?? [];
    if (tags.some((t) => SKIP_SENSE_TAGS.has(t))) continue;
    const glosses = s.glosses ?? [];
    const en = clean(glosses[glosses.length - 1], 300);
    if (!en) continue;
    for (const t of tags) {
      if (REGISTER_TAGS[t]) registers.add(REGISTER_TAGS[t]);
      if (REGION_TAGS[t]) regions.add(REGION_TAGS[t]);
      if (CAUTION_TAGS.has(t)) cautions.add(t);
    }
    syn.push(...relWords(s.synonyms));
    ant.push(...relWords(s.antonyms));
    const ex = (s.examples ?? []).find(
      (x) => x && typeof x.text === "string" && !x.ref && x.type !== "quotation" && x.text.length <= 160,
    );
    const def = { en };
    const labels = tags.filter((t) => REGISTER_TAGS[t] || CAUTION_TAGS.has(t) || REGION_TAGS[t]);
    if (labels.length) def.tags = [...new Set(labels)];
    if (ex) def.ex = clean(ex.text, 160);
    if (!def.ex) delete def.ex;
    defs.push(def);
    if (defs.length >= 5) break;
  }
  if (lemmaSenses === 0 || defs.length === 0) return null;

  // 英語版の「翻訳表」にある日本語（人が書いた訳語。機械翻訳ではない）
  const jaTr = [];
  const trList = [...(rec.translations ?? []), ...(rec.senses ?? []).flatMap((s) => s.translations ?? [])];
  for (const t of trList) {
    if (t?.code !== "ja" && t?.lang !== "Japanese") continue;
    const w = clean(t.word, 40);
    if (w && !jaTr.includes(w)) jaTr.push(w);
    if (jaTr.length >= 6) break;
  }

  return {
    word: rec.word,
    pos,
    ipa: pickIpa(rec.sounds),
    defs,
    jaTr,
    syn: [...new Set(syn)].slice(0, 8),
    ant: [...new Set(ant)].slice(0, 8),
    registers: [...registers],
    regions: [...regions],
    cautions: [...cautions],
  };
}

/** 日本語版 Wiktionary の「英語」の項目から、日本語の語義を取り出す */
export function convertJaRecord(rec) {
  if (!rec || rec.lang_code !== "en" || typeof rec.word !== "string") return null;
  const pos = mapPos(rec.pos);
  if (!pos) return null;
  const glosses = [];
  for (const s of rec.senses ?? []) {
    if (s.form_of || s.alt_of) continue;
    const g = s.glosses ?? [];
    const ja = clean(g[g.length - 1], 120);
    // 日本語を含む語義だけ（英語のままの語義は除く）
    if (ja && /[぀-ヿ一-鿿]/.test(ja) && !glosses.includes(ja)) glosses.push(ja);
    if (glosses.length >= 5) break;
  }
  if (glosses.length === 0) return null;
  return { word: rec.word, pos, glosses };
}

/** CSV（ダブルクォート対応の簡易版） */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/**
 * CEFR-J / Octanove の語彙表を読む。列名は大文字小文字を区別せず探す。
 * 見つからなければ例外（推測で列を決めない）。
 * 戻り値: Map<小文字の語, { level, pos: Set }>
 */
export function readCefrTable(text, sourceName) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const wi = header.findIndex((h) => h === "headword" || h === "word" || h === "lemma");
  const li = header.findIndex((h) => h === "cefr" || h === "level" || h === "cefr level" || h === "cefr-j");
  const pi = header.findIndex((h) => h === "pos" || h === "part of speech");
  if (wi < 0 || li < 0) {
    throw new Error(`${sourceName}: 列名が想定と違います（見つかった列: ${rows[0]?.join(" | ")}）`);
  }
  const map = new Map();
  for (const r of rows.slice(1)) {
    const level = (r[li] ?? "").trim().toUpperCase().slice(0, 2);
    if (!CEFR_ORDER.includes(level)) continue;
    // "a/an" のような表記は分けて登録
    for (const w of (r[wi] ?? "").split("/")) {
      const word = w.trim().toLowerCase();
      if (!isWordToken(word)) continue;
      const cur = map.get(word);
      const pos = (pi >= 0 ? r[pi] ?? "" : "").trim().toLowerCase();
      // 同じ語が複数の品詞で載っているときは、いちばん易しいレベルを語のレベルにする
      if (!cur || CEFR_ORDER.indexOf(level) < CEFR_ORDER.indexOf(cur.level)) {
        map.set(word, { level, source: sourceName, pos: new Set([...(cur?.pos ?? []), pos].filter(Boolean)) });
      } else if (pos) cur.pos.add(pos);
    }
  }
  return map;
}

/**
 * 収録順を決める（1,000 → 5,000 → 10,000 → 15,000 と増やしても、前の語がそのまま残る順番）
 *   第1グループ: CEFR 表に載っている語 または 頻度上位 8,000 語 … 頻度順
 *   第2グループ: それ以外 … 頻度順
 */
export function orderCandidates(freqWords, cefrMap, tier1Rank = 8000) {
  const rank = new Map();
  freqWords.forEach((w, i) => {
    const k = w.toLowerCase();
    if (isWordToken(k) && !rank.has(k)) rank.set(k, i);
  });
  const all = new Set([...rank.keys(), ...cefrMap.keys()]);
  const r = (w) => rank.get(w) ?? Number.MAX_SAFE_INTEGER;
  const tier1 = [];
  const tier2 = [];
  for (const w of all) (cefrMap.has(w) || r(w) < tier1Rank ? tier1 : tier2).push(w);
  const cmp = (a, b) => r(a) - r(b) || a.localeCompare(b);
  return [...tier1.sort(cmp), ...tier2.sort(cmp)];
}

const shortJa = (s) => s.replace(/[。．]$/, "").slice(0, 28);

/**
 * 1語ぶんのデータをまとめる。
 * en: convertEnRecord の結果（品詞ごと）, ja: convertJaRecord の結果（品詞ごと）
 */
export function buildWord(word, enParts, jaParts, cefr) {
  const byPos = new Map();
  for (const p of enParts) {
    const cur = byPos.get(p.pos);
    if (!cur) byPos.set(p.pos, { ...p, defs: [...p.defs], jaTr: [...p.jaTr] });
    else {
      cur.defs.push(...p.defs);
      cur.defs = cur.defs.slice(0, 5);
      for (const t of p.jaTr) if (!cur.jaTr.includes(t)) cur.jaTr.push(t);
      cur.syn = [...new Set([...cur.syn, ...p.syn])].slice(0, 8);
      cur.ant = [...new Set([...cur.ant, ...p.ant])].slice(0, 8);
    }
  }
  const jaByPos = new Map();
  for (const j of jaParts) jaByPos.set(j.pos, [...(jaByPos.get(j.pos) ?? []), ...j.glosses].slice(0, 5));

  const ipa = {};
  const syn = new Set();
  const ant = new Set();
  const registers = new Set();
  const regions = new Set();
  const cautions = new Set();
  const pos = [];
  for (const [p, d] of byPos) {
    Object.assign(ipa, { ...d.ipa, ...ipa });
    d.syn.forEach((x) => x.toLowerCase() !== word && syn.add(x));
    d.ant.forEach((x) => ant.add(x));
    d.registers.forEach((x) => registers.add(x));
    d.regions.forEach((x) => regions.add(x));
    d.cautions.forEach((x) => cautions.add(x));
    const block = { p, defs: d.defs };
    const jaGl = jaByPos.get(p) ?? [];
    if (jaGl.length) block.ja = jaGl;
    if (d.jaTr.length) block.jaTr = d.jaTr.slice(0, 6);
    pos.push(block);
  }
  if (ipa.any && (ipa.us || ipa.uk)) delete ipa.any;

  const out = { w: word, pos };
  if (Object.keys(ipa).length) out.ipa = ipa;
  if (cefr) {
    out.cefr = cefr.level;
    out.cefrSrc = cefr.source;
  }
  if (syn.size) out.syn = [...syn].slice(0, 10);
  if (ant.size) out.ant = [...ant].slice(0, 10);
  if (registers.size) out.reg = [...registers];
  if (regions.size) out.rgn = [...regions];
  if (cautions.size) out.caution = [...cautions];

  // 一覧用の短い日本語（日本語版の語義 → 翻訳表の訳語 の順。どちらも無ければ空）
  const firstJa = pos.find((b) => b.ja?.length)?.ja?.[0] ?? pos.find((b) => b.jaTr?.length)?.jaTr?.[0] ?? "";
  return { record: out, jaShort: firstJa ? shortJa(firstJa) : "" };
}

/** 分割ファイル名（先頭の文字ごと） */
export function shardOf(word) {
  const c = word[0]?.toLowerCase() ?? "";
  return /[a-z]/.test(c) ? c : "_";
}
