import * as fs from "fs";
import * as path from "path";
import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";
import * as jsdiff from "diff";
import fastDiff from "fast-diff";

const CORPUS_DIR = path.join(process.cwd(), "corpus");

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

interface PerfMetrics {
  scenario: string;
  engine: string;
  p50: number; // ms
  p95: number; // ms
  mean: number; // ms
  min: number; // ms
  max: number; // ms
  heapUsedDeltaKB: number;
  timedOut?: boolean;
}

const WARMUP_RUNS = 1;
const MEASURE_RUNS = 5;

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function runBenchmarkOnEngine(
  name: string,
  fn: () => void,
  maxTimeoutMs = 5000
): { p50: number; p95: number; mean: number; min: number; max: number; heapDeltaKB: number; timedOut?: boolean } {
  // Test single run to check if it's pathological
  const test0 = performance.now();
  try {
    fn();
  } catch (e: any) {
    return { p50: -1, p95: -1, mean: -1, min: -1, max: -1, heapDeltaKB: 0, timedOut: true };
  }
  const singleDuration = performance.now() - test0;
  
  if (singleDuration > maxTimeoutMs) {
    return {
      p50: Number(singleDuration.toFixed(3)),
      p95: Number(singleDuration.toFixed(3)),
      mean: Number(singleDuration.toFixed(3)),
      min: Number(singleDuration.toFixed(3)),
      max: Number(singleDuration.toFixed(3)),
      heapDeltaKB: 0,
      timedOut: true
    };
  }

  // Warmup
  for (let i = 0; i < WARMUP_RUNS; i++) {
    fn();
  }

  const times: number[] = [singleDuration];
  const heapBefore = process.memoryUsage().heapUsed;

  for (let i = 1; i < MEASURE_RUNS; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    times.push(t1 - t0);
  }

  const heapAfter = process.memoryUsage().heapUsed;
  const heapDeltaKB = Math.max(0, Math.round((heapAfter - heapBefore) / 1024));

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);

  return {
    p50: Number(percentile(times, 50).toFixed(3)),
    p95: Number(percentile(times, 95).toFixed(3)),
    mean: Number((sum / times.length).toFixed(3)),
    min: Number(times[0].toFixed(3)),
    max: Number(times[times.length - 1].toFixed(3)),
    heapDeltaKB,
  };
}

const runtimeName = typeof (globalThis as any).Bun !== "undefined" ? `Bun ${Bun.version}` : `Node.js ${process.version}`;
console.log(`=== TEXTDIFFNEXT PERFORMANCE BENCHMARK (${runtimeName}) ===`);
console.log(`Warmup: ${WARMUP_RUNS} runs, Iterations: ${MEASURE_RUNS} runs per scenario\n`);

const results: PerfMetrics[] = [];

for (const sc of scenarios) {
  const textA = fs.readFileSync(path.join(CORPUS_DIR, sc.fileA), "utf8");
  const textB = fs.readFileSync(path.join(CORPUS_DIR, sc.fileB), "utf8");

  // fast-diff
  const fPerf = runBenchmarkOnEngine("fast-diff", () => {
    fastDiff(textA, textB);
  });
  results.push({ scenario: sc.name, engine: "fast-diff", ...fPerf });

  // Google DMP
  const gDmp = new GoogleDMP();
  const gPerf = runBenchmarkOnEngine("Google DMP", () => {
    const diffs = gDmp.diff_main(textA, textB);
    gDmp.diff_cleanupSemantic(diffs);
  });
  results.push({ scenario: sc.name, engine: "Google DMP", ...gPerf });

  // Sanity DMP
  const sPerf = runBenchmarkOnEngine("Sanity DMP", () => {
    const diffs = SanityDMP.makeDiff(textA, textB);
    SanityDMP.cleanupSemantic(diffs);
  });
  results.push({ scenario: sc.name, engine: "Sanity DMP", ...sPerf });

  // jsdiff
  const jPerf = runBenchmarkOnEngine("jsdiff", () => {
    jsdiff.diffChars(textA, textB);
  }, 2500); // 2.5s guard
  results.push({ scenario: sc.name, engine: "jsdiff", ...jPerf });

  console.log(`Scenario [${sc.name}]:`);
  console.log(`  fast-diff:  p50=${fPerf.p50}ms, p95=${fPerf.p95}ms`);
  console.log(`  Google DMP: p50=${gPerf.p50}ms, p95=${gPerf.p95}ms`);
  console.log(`  Sanity DMP: p50=${sPerf.p50}ms, p95=${sPerf.p95}ms`);
  console.log(`  jsdiff:     p50=${jPerf.p50}ms, p95=${jPerf.p95}ms ${jPerf.timedOut ? '[TIMEOUT/PATHOLOGICAL]' : ''}`);
}

// Print markdown table
console.log("\n### Summary Performance Table (" + runtimeName + ")");
console.log("| Scenario | Engine | p50 (ms) | p95 (ms) | Mean (ms) | Min (ms) | Max (ms) | Heap Delta (KB) |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of results) {
  console.log(`| ${r.scenario} | ${r.engine} | ${r.p50} | ${r.p95} | ${r.mean} | ${r.min} | ${r.max} | ${r.heapDeltaKB} |`);
}

const tag = runtimeName.toLowerCase().startsWith("bun") ? "bun" : "node";
const outputFile = path.join(process.cwd() + "/benchmarks", `perf-${tag}.json`);
fs.writeFileSync(outputFile, JSON.stringify({ runtime: runtimeName, results }, null, 2));
console.log(`\nResults saved to: ${outputFile}`);
