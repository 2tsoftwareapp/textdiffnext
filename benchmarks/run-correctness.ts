import * as fs from "fs";
import * as path from "path";
import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";
import * as jsdiff from "diff";
import fastDiff from "fast-diff";

const CORPUS_DIR = path.join(__dirname, "../corpus");

interface Scenario {
  name: string;
  fileA: string;
  fileB: string;
}

const scenarios: Scenario[] = [
  { name: "Prose Short", fileA: "prose_short_a.txt", fileB: "prose_short_b.txt" },
  { name: "Prose Long", fileA: "prose_long_a.txt", fileB: "prose_long_b.txt" },
  { name: "Code Short", fileA: "code_short_a.ts", fileB: "code_short_b.ts" },
  { name: "Code Long", fileA: "code_long_a.ts", fileB: "code_long_b.ts" },
  { name: "Data JSON Short", fileA: "data_short_a.json", fileB: "data_short_b.json" },
  { name: "Data JSON Long", fileA: "data_long_a.json", fileB: "data_long_b.json" },
  { name: "Markdown Dense", fileA: "markdown_a.md", fileB: "markdown_b.md" },
  { name: "Large File", fileA: "large_file_a.txt", fileB: "large_file_b.txt" },
  { name: "Repetitive Lines", fileA: "repetitive_lines_a.txt", fileB: "repetitive_lines_b.txt" },
  { name: "Sparse Edits", fileA: "sparse_edits_a.txt", fileB: "sparse_edits_b.txt" },
  { name: "Dense Edits", fileA: "dense_edits_a.txt", fileB: "dense_edits_b.txt" },
  { name: "Completely Different", fileA: "completely_different_a.txt", fileB: "completely_different_b.txt" },
  { name: "Long Single Line", fileA: "long_single_line_a.txt", fileB: "long_single_line_b.txt" },
  { name: "Unicode Heavy", fileA: "unicode_heavy_a.txt", fileB: "unicode_heavy_b.txt" },
  { name: "Newline Edge Cases", fileA: "newline_edge_cases_a.txt", fileB: "newline_edge_cases_b.txt" },
];

export interface CorrectnessResult {
  scenario: string;
  engine: string;
  diffOk: boolean;
  deterministic: boolean;
  patchGenerated: boolean;
  patchSize: number; // bytes
  patchRoundtripOk: boolean;
  notes?: string;
}

const results: CorrectnessResult[] = [];

console.log("=== CORPUS CORRECTNESS & FUNCTIONAL RECONSTRUCTION BENCHMARK ===\n");

for (const sc of scenarios) {
  const textA = fs.readFileSync(path.join(CORPUS_DIR, sc.fileA), "utf8");
  const textB = fs.readFileSync(path.join(CORPUS_DIR, sc.fileB), "utf8");

  // 1. Google DMP
  try {
    const dmp = new GoogleDMP();
    const d1 = dmp.diff_main(textA, textB);
    dmp.diff_cleanupSemantic(d1);
    const d2 = dmp.diff_main(textA, textB);
    dmp.diff_cleanupSemantic(d2);
    const deterministic = JSON.stringify(d1) === JSON.stringify(d2);
    const reconstructed = d1.reduce((acc, [op, t]) => op >= 0 ? acc + t : acc, "");
    const diffOk = reconstructed === textB;

    let patchGenerated = false;
    let patchSize = 0;
    let patchRoundtripOk = false;
    let notes = "";
    try {
      const patches = dmp.patch_make(textA, textB);
      const patchText = dmp.patch_toText(patches);
      patchSize = Buffer.byteLength(patchText, "utf8");
      patchGenerated = true;
      const parsed = dmp.patch_fromText(patchText);
      const [applied, outcomes] = dmp.patch_apply(parsed, textA);
      patchRoundtripOk = applied === textB && outcomes.every(Boolean);
    } catch (e: any) {
      notes = `Patch error: ${e.message}`;
    }

    results.push({
      scenario: sc.name,
      engine: "Google DMP",
      diffOk,
      deterministic,
      patchGenerated,
      patchSize,
      patchRoundtripOk,
      notes
    });
  } catch (e: any) {
    results.push({
      scenario: sc.name,
      engine: "Google DMP",
      diffOk: false,
      deterministic: false,
      patchGenerated: false,
      patchSize: 0,
      patchRoundtripOk: false,
      notes: `Diff crash: ${e.message}`
    });
  }

  // 2. Sanity DMP
  try {
    const d1 = SanityDMP.makeDiff(textA, textB);
    SanityDMP.cleanupSemantic(d1);
    const d2 = SanityDMP.makeDiff(textA, textB);
    SanityDMP.cleanupSemantic(d2);
    const deterministic = JSON.stringify(d1) === JSON.stringify(d2);
    const reconstructed = d1.reduce((acc, [op, t]) => op >= 0 ? acc + t : acc, "");
    const diffOk = reconstructed === textB;

    let patchGenerated = false;
    let patchSize = 0;
    let patchRoundtripOk = false;
    let notes = "";
    try {
      const patches = SanityDMP.makePatches(textA, textB);
      const patchText = SanityDMP.stringifyPatches(patches);
      patchSize = Buffer.byteLength(patchText, "utf8");
      patchGenerated = true;
      const parsed = SanityDMP.parsePatch(patchText);
      const [applied, outcomes] = SanityDMP.applyPatches(parsed, textA);
      patchRoundtripOk = applied === textB && outcomes.every(Boolean);
    } catch (e: any) {
      notes = `Patch error: ${e.message}`;
    }

    results.push({
      scenario: sc.name,
      engine: "Sanity DMP",
      diffOk,
      deterministic,
      patchGenerated,
      patchSize,
      patchRoundtripOk,
      notes
    });
  } catch (e: any) {
    results.push({
      scenario: sc.name,
      engine: "Sanity DMP",
      diffOk: false,
      deterministic: false,
      patchGenerated: false,
      patchSize: 0,
      patchRoundtripOk: false,
      notes: `Diff crash: ${e.message}`
    });
  }

  // 3. jsdiff
  try {
    const d1 = jsdiff.diffChars(textA, textB);
    const d2 = jsdiff.diffChars(textA, textB);
    const deterministic = JSON.stringify(d1) === JSON.stringify(d2);
    const reconstructed = d1.reduce((acc, p) => p.removed ? acc : acc + p.value, "");
    const diffOk = reconstructed === textB;

    let patchGenerated = false;
    let patchSize = 0;
    let patchRoundtripOk = false;
    let notes = "";
    try {
      const patchText = jsdiff.createPatch("file.txt", textA, textB);
      patchSize = Buffer.byteLength(patchText, "utf8");
      patchGenerated = true;
      const applied = jsdiff.applyPatch(textA, patchText);
      patchRoundtripOk = applied === textB;
      if (applied === false) {
        notes = "applyPatch returned false";
      }
    } catch (e: any) {
      notes = `Patch error: ${e.message}`;
    }

    results.push({
      scenario: sc.name,
      engine: "jsdiff",
      diffOk,
      deterministic,
      patchGenerated,
      patchSize,
      patchRoundtripOk,
      notes
    });
  } catch (e: any) {
    results.push({
      scenario: sc.name,
      engine: "jsdiff",
      diffOk: false,
      deterministic: false,
      patchGenerated: false,
      patchSize: 0,
      patchRoundtripOk: false,
      notes: `Diff crash: ${e.message}`
    });
  }

  // 4. fast-diff
  try {
    const d1 = fastDiff(textA, textB);
    const d2 = fastDiff(textA, textB);
    const deterministic = JSON.stringify(d1) === JSON.stringify(d2);
    const reconstructed = d1.reduce((acc, [op, t]) => op >= 0 ? acc + t : acc, "");
    const diffOk = reconstructed === textB;

    results.push({
      scenario: sc.name,
      engine: "fast-diff",
      diffOk,
      deterministic,
      patchGenerated: false,
      patchSize: 0,
      patchRoundtripOk: false,
      notes: "Diff-only engine (no match/patch API)"
    });
  } catch (e: any) {
    results.push({
      scenario: sc.name,
      engine: "fast-diff",
      diffOk: false,
      deterministic: false,
      patchGenerated: false,
      patchSize: 0,
      patchRoundtripOk: false,
      notes: `Diff crash: ${e.message}`
    });
  }
}

// 16. Drifted patch test
console.log("\n--- Testing Drifted Patch Scenario ---");
const driftBase = fs.readFileSync(path.join(CORPUS_DIR, "drifted_patch_base.txt"), "utf8");
const driftMod = fs.readFileSync(path.join(CORPUS_DIR, "drifted_patch_modified.txt"), "utf8");
const driftTarget = fs.readFileSync(path.join(CORPUS_DIR, "drifted_patch_target.txt"), "utf8");

// Google DMP
const dmp = new GoogleDMP();
const gPatches = dmp.patch_make(driftBase, driftMod);
const [gDriftRes, gOutcomes] = dmp.patch_apply(gPatches, driftTarget);
const gFuzzySuccess = gOutcomes.every(Boolean) && gDriftRes.includes("Key not found");

// Sanity DMP
const sPatches = SanityDMP.makePatches(driftBase, driftMod);
const [sDriftRes, sOutcomes] = SanityDMP.applyPatches(sPatches, driftTarget);
const sFuzzySuccess = sOutcomes.every(Boolean) && sDriftRes.includes("Key not found");

// jsdiff
let jFuzzySuccess = false;
try {
  const jPatch = jsdiff.createPatch("file.txt", driftBase, driftMod);
  const jDriftRes = jsdiff.applyPatch(driftTarget, jPatch, { fuzzFactor: 4 });
  jFuzzySuccess = jDriftRes !== false && (jDriftRes as string).includes("Key not found");
} catch (e) {
  jFuzzySuccess = false;
}

console.log(`Fuzzy patch on drifted source:`);
console.log(`  Google DMP: success=${gFuzzySuccess}, outcomes=${JSON.stringify(gOutcomes)}`);
console.log(`  Sanity DMP: success=${sFuzzySuccess}, outcomes=${JSON.stringify(sOutcomes)}`);
console.log(`  jsdiff:     success=${jFuzzySuccess}`);
console.log(`  fast-diff:  N/A (no patch engine)`);

// Print markdown table of correctness
console.log("\n| Scenario | Engine | Diff Correct? | Deterministic? | Patch Gen? | Patch Size (B) | Patch Roundtrip? | Notes |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of results) {
  console.log(`| ${r.scenario} | ${r.engine} | ${r.diffOk ? "PASS" : "FAIL"} | ${r.deterministic ? "YES" : "NO"} | ${r.patchGenerated ? "YES" : "NO"} | ${r.patchSize} | ${r.patchRoundtripOk ? "PASS" : "FAIL"} | ${r.notes || "OK"} |`);
}

// Save json result
fs.writeFileSync(path.join(__dirname, "correctness-results.json"), JSON.stringify({ results, fuzzyDrift: { GoogleDMP: gFuzzySuccess, SanityDMP: sFuzzySuccess, jsdiff: jFuzzySuccess } }, null, 2));
