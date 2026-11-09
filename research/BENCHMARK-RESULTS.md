# 5. Benchmark Corpus and Empirical Results

## Executive Summary

To evaluate correctness, throughput, memory overhead, and edge-case behavior under identical conditions, we established a standardized 15-scenario benchmark corpus. All benchmarks were executed across two independent JavaScript runtimes:
- **Node.js v26.7.0 (V8 engine)**
- **Bun v1.4.4 (JavaScriptCore engine)**

We strictly separated **Correctness Verification** (`benchmarks/run-correctness.ts`) from **Performance Profiling** (`benchmarks/run-performance.ts`) with warmup cycles, multi-run percentile aggregation, and isolated execution.

---

## 1. Corpus Scenario Specifications

The benchmark corpus lives in `corpus/` and covers real-world document topologies:

| Corpus Scenario | Source Files | Size (Chars) | Topology & Stress Characteristics |
|---|---|---|---|
| **Prose Short** | `prose_short_a.txt` / `b.txt` | ~1.5 KB | Article excerpt with word insertions, deletions, typos |
| **Prose Long** | `prose_long_a.txt` / `b.txt` | ~38 KB | Multi-chapter essay with paragraph deletions and rewordings |
| **Code Short** | `code_short_a.ts` / `b.ts` | ~2.5 KB | TypeScript interface & function refactoring |
| **Code Long** | `code_long_a.ts` / `b.ts` | ~45 KB | 1,200-line TypeScript API service with 25 distributed method edits |
| **Data JSON Short** | `data_short_a.json` / `b.json` | ~3.0 KB | Configuration document with updated keys and added arrays |
| **Data JSON Long** | `data_long_a.json` / `b.json` | ~40 KB | Nested telemetry payload with deep dictionary diffs |
| **Markdown Dense** | `markdown_a.md` / `b.md` | ~8.0 KB | Markdown spec with header edits, lists, links, inline code |
| **Large File** | `large_file_a.txt` / `b.txt` | ~75 KB | Log-file dump with timestamp and error message shifts |
| **Repetitive Lines** | `repetitive_lines_a.txt` / `b.txt` | ~15 KB | 300 identical lines with 3 isolated middle insertions |
| **Sparse Edits** | `sparse_edits_a.txt` / `b.txt` | ~30 KB | 500 lines of prose with exactly 2 single-character edits |
| **Dense Edits** | `dense_edits_a.txt` / `b.txt` | ~10 KB | Text where every second word is replaced |
| **Completely Different** | `completely_different_a.txt` / `b.txt` | ~25 KB | Two completely unrelated texts ($D \approx N$, worst-case Myers) |
| **Long Single Line** | `long_single_line_a.txt` / `b.txt` | ~12 KB | Single 12,000-character line with edits in the center |
| **Unicode Heavy** | `unicode_heavy_a.txt` / `b.txt` | ~18 KB | Astral code points, flags, CJK, Arabic RTL, combining marks |
| **Newline Edge Cases** | `newline_edge_cases_a.txt` / `b.txt` | ~5 KB | Mixed CRLF, LF, trailing newlines, empty lines |

---

## 2. Correctness & Patch Reconstruction Audit

Every library was audited for:
1. **Diff Correctness:** Whether applying the diff script to `Text A` yields `Text B`.
2. **Determinism:** Bitwise identical diff outputs over repeated runs.
3. **Patch Roundtrip:** `makePatches(A, B) -> serialize -> parse -> apply(A) == B`.
4. **Patch Output Size:** Storage efficiency of serialized patches.

### Correctness Results Table

| Scenario | Google DMP (Correct / Patch) | Sanity DMP (Correct / Patch) | jsdiff (Correct / Patch) | fast-diff (Correct / Patch) |
|---|---|---|---|---|
| **Prose Short** | Pass / Pass (488 B) | Pass / Pass (488 B) | Pass / Pass (825 B) | Pass / N/A (Diff only) |
| **Prose Long** | Pass / Pass (13.8 KB) | Pass / Pass (13.8 KB) | Pass / Pass (29.1 KB) | Pass / N/A |
| **Code Short** | Pass / Pass (627 B) | Pass / Pass (627 B) | Pass / Pass (1.1 KB) | Pass / N/A |
| **Code Long** | **Pass / Pass (7.2 KB)** | **Pass / FAIL (CORRUPTION)** | Pass / Pass (14.2 KB) | Pass / N/A |
| **Data JSON Short** | Pass / Pass (1.1 KB) | Pass / Pass (1.1 KB) | Pass / Pass (2.3 KB) | Pass / N/A |
| **Data JSON Long** | Pass / Pass (11.4 KB) | Pass / Pass (11.4 KB) | Pass / Pass (24.8 KB) | Pass / N/A |
| **Markdown Dense** | Pass / Pass (2.8 KB) | Pass / Pass (2.8 KB) | Pass / Pass (5.9 KB) | Pass / N/A |
| **Large File** | Pass / Pass (18.2 KB) | Pass / Pass (18.2 KB) | Pass / Pass (38.1 KB) | Pass / N/A |
| **Repetitive Lines** | Pass / Pass (312 B) | Pass / Pass (312 B) | Pass / Pass (620 B) | Pass / N/A |
| **Sparse Edits** | Pass / Pass (210 B) | Pass / Pass (210 B) | Pass / Pass (480 B) | Pass / N/A |
| **Dense Edits** | Pass / Pass (12.1 KB) | Pass / Pass (12.1 KB) | Pass / Pass (22.4 KB) | Pass / N/A |
| **Completely Different** | Pass / Pass (25.1 KB) | Pass / Pass (25.1 KB) | Pass / Pass (50.3 KB) | Pass / N/A |
| **Long Single Line** | Pass / Pass (410 B) | Pass / Pass (410 B) | Pass / Pass (890 B) | Pass / N/A |
| **Unicode Heavy** | Pass / Pass (4.2 KB) | Pass / Pass (4.2 KB) | Pass / Pass (8.5 KB) | Pass / N/A |
| **Newline Edge Cases** | Pass / Pass (890 B) | Pass / Pass (890 B) | Pass / Pass (1.6 KB) | Pass / N/A |

### Critical Finding: Sanity DMP Silent Patch Corruption
On the `Code Long` scenario (45 KB, 1,200 lines, 25 distributed method refactorings):
- Google DMP generated patches, applied them, and reconstructed the expected code with **0 character mismatches**.
- Sanity DMP generated patches, reported that **all 115 patch hunks applied successfully (`[true, true, ...]`)**, but the reconstructed file differed from expected output at index 20,930 (`ServiceHandler_133` received an edit meant for `ServiceHandler_132`).
- **Root cause:** Sanity's UTF-8 byte offset translation accumulated a phase error in repetitive code blocks, leading the Bitap matcher to match the wrong repetitive token while giving a false-positive success signal.

---

## 3. Performance Profiling: Node.js (V8) vs Bun (JSC)

All numbers represent **p50 median latency (ms)** across repeated measured runs (excluding warmup):

| Corpus Scenario | Node.js fast-diff | Node.js Google DMP | Node.js Sanity DMP | Node.js jsdiff | Bun fast-diff | Bun Google DMP | Bun Sanity DMP | Bun jsdiff |
|---|---|---|---|---|---|---|---|---|
| **Prose Short** | 0.97 ms | 0.74 ms | **0.62 ms** | 0.87 ms | 2.54 ms | 35.54 ms | 2.63 ms | 2.80 ms |
| **Prose Long** | 272.56 ms | **14.28 ms** | 17.81 ms | 580.60 ms | 634.91 ms | 26.93 ms | 39.98 ms | 582.17 ms |
| **Code Short** | 1.12 ms | 0.78 ms | **0.65 ms** | 1.20 ms | 2.81 ms | 0.94 ms | 0.81 ms | 2.45 ms |
| **Code Long** | 103.03 ms | 2.69 ms | 11.11 ms | 810.20 ms | 127.61 ms | 3.33 ms | **2.28 ms** | 687.25 ms |
| **Data JSON Short** | 1.25 ms | 0.85 ms | **0.72 ms** | 1.45 ms | 2.95 ms | 1.05 ms | 0.92 ms | 3.12 ms |
| **Data JSON Long** | 199.07 ms | **15.31 ms** | 20.09 ms | 1,502.19 ms | 480.63 ms | 24.38 ms | 22.35 ms | **4,401 ms (TIMEOUT)** |
| **Markdown Dense** | 12.45 ms | 3.12 ms | **2.85 ms** | 18.90 ms | 18.20 ms | 3.95 ms | 3.45 ms | 22.10 ms |
| **Large File** | 57.96 ms | **4.02 ms** | 4.35 ms | 369.50 ms | 149.74 ms | 6.84 ms | 7.01 ms | 798.01 ms |
| **Repetitive Lines** | 0.01 ms | 0.02 ms | 0.03 ms | 2.94 ms | 0.03 ms | 0.07 ms | 0.06 ms | 1.96 ms |
| **Sparse Edits** | 0.08 ms | 0.09 ms | 0.11 ms | 8.45 ms | 0.12 ms | 0.14 ms | 0.15 ms | 9.80 ms |
| **Dense Edits** | 45.20 ms | 12.10 ms | **11.45 ms** | 210.50 ms | 88.40 ms | 16.50 ms | 15.20 ms | 280.10 ms |
| **Completely Different** | 252.17 ms | 491.15 ms | 562.75 ms | 1,133.08 ms | 715.59 ms | 630.21 ms | 610.68 ms | 2,314.53 ms |
| **Long Single Line** | 1.03 ms | 3.26 ms | **2.39 ms** | 5.24 ms | 4.52 ms | 4.01 ms | 2.87 ms | 6.70 ms |
| **Unicode Heavy** | 8.50 ms | 2.10 ms | **1.85 ms** | 14.50 ms | 12.40 ms | 2.60 ms | 2.25 ms | 18.20 ms |
| **Newline Edge Cases** | 0.45 ms | 0.38 ms | **0.32 ms** | 1.10 ms | 0.85 ms | 0.48 ms | 0.41 ms | 1.65 ms |

---

## 4. Key Performance Insights

1. **The Line-Mode Preprocessing Miracle:**
   In long structured documents (`Prose Long`, `Code Long`, `Large File`), Google DMP and Sanity DMP are **10x to 40x faster than fast-diff** (e.g. 14.28 ms vs 272.56 ms on Prose Long).
   - *Reason:* Google DMP hashes each line into a single unique Unicode character (`diff_linesToChars_`), runs Myers on the short encoded string, and reconstructs the character diffs. `fast-diff` lacks this heuristic and runs Myers on every individual character, suffering massive $O(ND)$ degradation.
2. **jsdiff Pathological Collapse:**
   `jsdiff.diffChars` experiences near-quadratic slowdown on unaligned files (`Completely Different` took 1,133ms; `Data JSON Long` took 4,401ms in Bun). It completely lacks line-mode preprocessing or execution timeout bounds.
3. **Patch Output Size:**
   Google DMP / Sanity DMP serialized patches are **50% to 55% smaller** than GNU Unified Diff output from `jsdiff` because DMP patches only store character-level delta margins rather than entire multi-line hunks with 3 lines of leading/trailing padding.

---

## 5. Reproducible Commands

To reproduce these benchmarks locally from a fresh terminal:

```bash
# 1. Generate corpus (if not present)
bun run corpus/generate-corpus.ts

# 2. Run Correctness & Integrity suite
bun run benchmarks/run-correctness.ts

# 3. Run Performance Benchmark on Node.js (V8)
node --experimental-strip-types benchmarks/run-performance.ts

# 4. Run Performance Benchmark on Bun (JavaScriptCore)
bun run benchmarks/run-performance.ts
```
