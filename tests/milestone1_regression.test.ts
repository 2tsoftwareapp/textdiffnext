import {test, expect, describe} from "bun:test";
import * as tdn from "../src/index.js";
import * as sanity from "@sanity/diff-match-patch";
import * as googleModule from "diff-match-patch";
const GoogleDMP = (googleModule as any).diff_match_patch || (googleModule as any).default || googleModule;
import * as fs from "node:fs";

describe("Milestone 1: Index Restoration & Regression Tests", () => {
  test("1. ASCII regression: simple insertions, deletions, equalities", () => {
    const a = "The quick brown fox jumps over the lazy dog.";
    const b = "That quick brown fox leaped over a lazy dog!";
    const patches = tdn.makePatches(a, b);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, a);

    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test("2. BMP Unicode regression: Vietnamese, Cyrillic, CJK, accents", () => {
    const a = "Tiếng Việt là một ngôn ngữ thanh điệu phong phú. Привет мир! こんにちは世界！";
    const b = "Tiếng Việt là ngôn ngữ rất phong phú và đẹp. Привет прекрасный мир! こんにちは、世界！";
    const patches = tdn.makePatches(a, b);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, a);

    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);
  });

  test("3. Astral Unicode regression: emojis, supplementary plane codepoints", () => {
    // Note: When diff boundaries split between non-identical astral characters,
    // in-memory patch application operates seamlessly on UTF-16 code units.
    const a = "Hello 🌍 world! Here is an apple 🍎 and a star ⭐.";
    const b = "Hello 🌏 planet! Here is a banana 🍌 and a shining star 🌟.";
    const patches = tdn.makePatches(a, b);

    // In-memory patch apply on astral Unicode
    const [reconstructed, results] = tdn.applyPatches(patches, a);
    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);

    // Serialization with whole surrogate pairs:
    const aWhole = "Section A 🚀 Rocket launched. Code: 💎 Diamond.";
    const bWhole = "Section B 🚀 Rocket launched! Code: 💎 Diamond.";
    const pWhole = tdn.makePatches(aWhole, bWhole);
    const pStr = tdn.stringifyPatches(pWhole);
    const parsed = tdn.parsePatch(pStr);
    const [reconstructedWhole, resWhole] = tdn.applyPatches(parsed, aWhole);
    expect(reconstructedWhole).toBe(bWhole);
    expect(resWhole.every(Boolean)).toBe(true);
  });

  test("4. Repetitive source code regression", () => {
    const a = fs.readFileSync("corpus/repetitive_lines_a.txt", "utf8");
    const b = fs.readFileSync("corpus/repetitive_lines_b.txt", "utf8");
    const patches = tdn.makePatches(a, b);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, a);

    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);
  });

  test("5. 45 KB Code Long corpus (demonstrating Sanity offset bug fix)", () => {
    const a = fs.readFileSync("corpus/code_long_a.ts", "utf8");
    const b = fs.readFileSync("corpus/code_long_b.ts", "utf8");

    // 1. TDN passes exact reconstruction
    const patches = tdn.makePatches(a, b);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, a);

    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);
    expect(results.length).toBe(115);

    // 2. Original Sanity FAILS exact reconstruction on the identical corpus
    const sanityPatches = sanity.makePatches(a, b);
    const sanityStr = sanity.stringifyPatches(sanityPatches);
    const sanityParsed = sanity.parsePatch(sanityStr);
    const [sanityReconstructed, sanityResults] = sanity.applyPatches(sanityParsed, a);

    expect(sanityReconstructed === b).toBe(false); // Sanity silently corrupts!
    expect(sanityResults.every(Boolean)).toBe(true); // Sanity falsely claims all 115 hunks succeeded!
  });

  test("6. 75 KB Large file corpus", () => {
    const a = fs.readFileSync("corpus/large_file_a.txt", "utf8");
    const b = fs.readFileSync("corpus/large_file_b.txt", "utf8");
    const patches = tdn.makePatches(a, b);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, a);

    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);
  });

  test("7. Distributed edits & 8. Multiple patch hunks", () => {
    const a = fs.readFileSync("corpus/sparse_edits_a.txt", "utf8");
    const b = fs.readFileSync("corpus/sparse_edits_b.txt", "utf8");
    const patches = tdn.makePatches(a, b);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, a);

    expect(reconstructed).toBe(b);
    expect(results.every(Boolean)).toBe(true);
    expect(results.length).toBeGreaterThan(1);
  });

  test("9. Shifted context (fuzzy matching with offset delta)", () => {
    const base = fs.readFileSync("corpus/drifted_patch_base.txt", "utf8");
    const modified = fs.readFileSync("corpus/drifted_patch_modified.txt", "utf8");
    const target = fs.readFileSync("corpus/drifted_patch_target.txt", "utf8");

    const patches = tdn.makePatches(base, modified);
    const patchStr = tdn.stringifyPatches(patches);
    const parsed = tdn.parsePatch(patchStr);
    const [reconstructed, results] = tdn.applyPatches(parsed, target);

    expect(results.some(Boolean)).toBe(true);
    expect(reconstructed).toContain("if (!this.cache.has(key)) throw new Error(\"Key not found\");");
  });

  test("10. Full serialization and deserialization roundtrip", () => {
    const textA = "function greet(name: string): string {\n  return `Hello, ${name}!`;\n}";
    const textB = "export function greetUser(name: string, title?: string): string {\n  const greeting = title ? `${title} ${name}` : name;\n  return `Welcome, ${greeting}!`;\n}";

    const patches = tdn.makePatches(textA, textB);
    const serialized = tdn.stringifyPatches(patches);

    // Verify format matches standard @@ -start1,length1 +start2,length2 @@
    expect(serialized).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/);

    const parsed = tdn.parsePatch(serialized);
    expect(parsed.length).toBe(patches.length);
    for (let i = 0; i < patches.length; i++) {
      expect(parsed[i].start1).toBe(patches[i].start1);
      expect(parsed[i].start2).toBe(patches[i].start2);
      expect(parsed[i].length1).toBe(patches[i].length1);
      expect(parsed[i].length2).toBe(patches[i].length2);
    }

    const [applied, results] = tdn.applyPatches(parsed, textA);
    expect(applied).toBe(textB);
    expect(results.every(Boolean)).toBe(true);
  });

  test("11. Differential Cross-Compatibility with Google DMP", () => {
    const a = fs.readFileSync("corpus/code_long_a.ts", "utf8");
    const b = fs.readFileSync("corpus/code_long_b.ts", "utf8");

    const g = new GoogleDMP();
    const gPatch = g.patch_make(a, b);
    const gStr = g.patch_toText(gPatch);

    // TDN can parse and cleanly apply Google DMP serialized patch string
    const parsedGoogle = tdn.parsePatch(gStr);
    const [tdnFromGoogle, res1] = tdn.applyPatches(parsedGoogle, a);
    expect(tdnFromGoogle).toBe(b);
    expect(res1.every(Boolean)).toBe(true);

    // Google can parse and cleanly apply TDN serialized patch string
    const tdnPatch = tdn.makePatches(a, b);
    const tdnStr = tdn.stringifyPatches(tdnPatch);
    const [googleFromTdn, res2] = g.patch_apply(g.patch_fromText(tdnStr), a);
    expect(googleFromTdn).toBe(b);
    expect(res2.every(Boolean)).toBe(true);
  });
});
