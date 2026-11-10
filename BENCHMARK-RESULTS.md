# TextDiffNext — Milestone 1 Benchmark Results

## Environment & Methodology
- **Runtime**: Bun `1.4.4` (macOS arm64, Apple Silicon M-series, Darwin 26.6.2)
- **Node Equivalent**: Node.js compatibility layer inside Bun
- **Engines Evaluated**:
  1. `TextDiffNext` (Milestone 1 UTF-16 fork)
  2. `Google DMP` (`diff-match-patch` 1.0.5)
  3. `Sanity DMP` (`@sanity/diff-match-patch` 3.2.1)
  4. `fast-diff` 1.3.0
  5. `jsdiff` 7.0.0
- **Measurement Isolation**: Correctness evaluation and performance timing run in completely separate execution processes to prevent cross-contamination.
- **Timing Parameters**: Warmup iterations: 1-5 runs. Timed iterations: 5-20 runs per scenario. Metrics: p50 (median) latency, p95 latency, min/max, memory delta.

---

## 1. Correctness & Reconstruction Matrix (15 Scenarios)

| Scenario | File Types / Size | Google DMP | Sanity DMP | TextDiffNext (M1) | Silent Corruption Fixed? |
|---|---|---|---|---|---|
| **Prose Short** | TXT / ~1.5 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Prose Long** | TXT / ~38 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Code Short** | TS / ~1.2 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Code Long** | TS / ~45 KB (115 hunks) | PASS (100%) | **FAIL (CORRUPTED)** | **PASS (100%)** | **YES (Fixed patch 103 offset clamp)** |
| **Data JSON Short** | JSON / ~1.8 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Data JSON Long** | JSON / ~40 KB (240 hunks) | PASS (100%) | **FAIL (CORRUPTED)** | **PASS (100%)** | **YES (Fixed cumulative drift)** |
| **Markdown Dense** | MD / ~12 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Large File** | TXT / ~75 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Repetitive Lines** | TXT / ~8 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Sparse Edits** | TXT / ~64 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Dense Edits** | TS / ~22 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Completely Different** | TXT / ~15 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Long Single Line** | TXT / ~10 KB single line | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |
| **Unicode Heavy (Memory)**| TXT / ~4 KB astral/CJK | PASS (100%) | **FAIL (Exception)** | **PASS (100%)** | **YES (Eliminated byte mismatch throw)** |
| **Newline Edge Cases** | TXT / ~0.5 KB | PASS (100%) | PASS (100%) | **PASS (100%)** | N/A |

*Note on Unicode Heavy serialization*: Both Google DMP and Sanity DMP throw `URIError: String contained an illegal UTF-16 sequence` when attempting `encodeURI()` on lone surrogate halves split during diff segmentation. In-memory patch application succeeds 100% in TextDiffNext and Google DMP.

---

## 2. Performance Comparison: TextDiffNext vs Upstream

Eliminating the UTF-8 byte counting and sequential index translation layer eliminates O(N) string traversals in `make`, `splitMax`, and `apply`.

### Benchmark: Full Patch Pipeline (`makePatches` + `applyPatches`) on 45 KB Multi-Hunk Code
- **TextDiffNext**:
  - **p50 Latency**: `7.12 ms`
  - **p95 Latency**: `19.91 ms`
- **Sanity DMP**:
  - **p50 Latency**: `8.64 ms`
  - **p95 Latency**: `23.92 ms`
- **Speedup**: **~17.6% faster** in median latency, in addition to achieving 100% exact correctness.

### Differential Behavior vs Google DMP
- Google DMP diff cleanup and semantic merge rules differ subtly in whitespace chunking and leading character offsets.
- However, cross-engine interoperability is 100% verified:
  - TextDiffNext cleanly parses and applies patches emitted by Google DMP (`patch_toText`).
  - Google DMP cleanly parses and applies patches emitted by TextDiffNext (`stringifyPatches`).
