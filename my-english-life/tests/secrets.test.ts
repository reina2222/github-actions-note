/** AI の API を使っていないこと・秘密の鍵を持っていないことを、ソースから確認する */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd(); // vitest はプロジェクト直下で実行される
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx|js|mjs|json)$/.test(e.name) ? [p] : [];
  });
}

describe("no AI API, no secrets", () => {
  const src = [...files(path.join(ROOT, "src")), path.join(ROOT, "public/sw.js"), path.join(ROOT, "package.json")].map(
    (f) => ({ f: path.relative(ROOT, f), s: fs.readFileSync(f, "utf8") }),
  );

  it("does not call any AI API", () => {
    // 接続先のホスト名と、AI の SDK パッケージの読み込みを探す（説明文中の社名は対象外）
    const hosts =
      /api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|from\s+["'](@anthropic-ai\/[\w-]+|openai|@google\/generative-ai)["']|"(@anthropic-ai\/[\w-]+|openai|@google\/generative-ai)":/;
    expect(src.filter((x) => hosts.test(x.s)).map((x) => x.f)).toEqual([]);
  });

  it("does not read any API key or server secret", () => {
    expect(src.filter((x) => /process\.env\.(?!NODE_ENV)\w+/.test(x.s)).map((x) => x.f)).toEqual([]);
  });

  it("has no server API routes", () => {
    expect(fs.existsSync(path.join(ROOT, "src/app/api"))).toBe(false);
  });
});
