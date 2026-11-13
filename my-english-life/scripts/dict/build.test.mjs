// 辞書作成スクリプトのテスト（ネット不要）: node --test scripts/dict
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { convertEnRecord, orderCandidates, readCefrTable } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (f) => join(here, "fixtures", f);

test("引用文・古語・活用形・固有名詞・他言語を取り込まない", () => {
  const out = mkdtempSync(join(tmpdir(), "dict-"));
  execFileSync(process.execPath, [join(here, "build-dictionary.mjs"), "--size", "1000", "--en", fx("en.jsonl.gz"), "--ja", fx("ja.jsonl"), "--freq", fx("freq.txt"), "--cefrj", fx("cefrj.csv"), "--octanove", fx("octa.csv"), "--out", out], { stdio: "pipe" });
  const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
  assert.deepEqual(index.rows.map((r) => r[0]), ["alpha", "delta"]);
  const a = JSON.parse(readFileSync(join(out, "entries", "a.json"), "utf8")).alpha;
  const text = JSON.stringify(a);
  assert.ok(!text.includes("Quoted text"), "引用文は入れない");
  assert.ok(!text.includes("Old sense"), "古語は入れない");
  assert.equal(a.cefr, "A2"); // 品詞が複数あるときは易しい方
  assert.deepEqual(a.pos[0].ja, ["テスト用の語義。"]);
  const d = JSON.parse(readFileSync(join(out, "entries", "d.json"), "utf8")).delta;
  assert.equal(d.pos[0].ja, undefined, "日本語が無い語は空のまま");
  assert.equal(d.cefr, "C1");
});

test("CEFR 表の列が見つからなければ止まる（推測しない）", () => {
  assert.throws(() => readCefrTable("foo,bar\nx,y\n", "テスト"));
});

test("収録順は段階を増やしても前の語が残る", () => {
  const cefr = new Map([["zeta", { level: "C2" }]]);
  const order = orderCandidates(["b", "a", "c"], cefr, 2);
  assert.deepEqual(order, ["b", "a", "zeta", "c"]);
});

test("活用形だけの行は null", () => {
  assert.equal(convertEnRecord({ lang_code: "en", word: "went", pos: "verb", senses: [{ glosses: ["past of go"], form_of: [{ word: "go" }] }] }), null);
});
