# TextDiffNext — Independent Research & Feasibility Spike

An exhaustive research and feasibility spike evaluating whether a modern successor to Google's archived `diff-match-patch` is technically and commercially justified.

This repository contains:
1. **Upstream Snapshots & Hashes:** Exact byte-level archives and SHA-256 checksums of Google DMP, Sanity DMP, jsdiff, and fast-diff (`upstream-snapshots/`).
2. **Issue Reproductions:** Automated scripts reproducing Google DMP #149, #147, #143, and #142 (`tests/issues/`).
3. **Unicode Semantics Suite:** Comprehensive edge-case test suite covering surrogates, astral code points, grapheme clusters, flags, ZWJ sequences, combining marks, and line endings (`tests/unicode/`).
4. **Functional Testing Suite:** Audits of diff determinism, fuzzy matching, shifted patch application, and reverse patching (`tests/functional/`).
5. **15-Scenario Benchmark Corpus:** Reusable real-world test cases covering prose, code, JSON, Markdown, large files, and pathological inputs (`corpus/`).
6. **Dual-Runtime Benchmarks:** Automated correctness and performance benchmarks executed on Node.js (V8) and Bun (JavaScriptCore) (`benchmarks/`).
7. **WASM Boundary Probe:** Rust-compiled WebAssembly test harness measuring FFI boundary and serialization overhead (`benchmarks/wasm_probe/`).
8. **Eight Formal Research Deliverables:** Located in the `research/` directory.

---

## Research Deliverables (`research/`)

1. [`REPOSITORY-REVIEW.md`](research/REPOSITORY-REVIEW.md) — Repositories, licenses, commit hashes, npm package metadata, and maintenance signals.
2. [`ISSUE-REPRODUCTIONS.md`](research/ISSUE-REPRODUCTIONS.md) — Empirical reproductions and classifications for Google DMP Issues #149, #147, #143, and #142.
3. [`UNICODE-AND-TEXT-SEMANTICS.md`](research/UNICODE-AND-TEXT-SEMANTICS.md) — Indexing contracts (UTF-16 vs UTF-8 byte offsets), surrogate handling, and grapheme clusters.
4. [`COMPETITOR-COMPARISON.md`](research/COMPETITOR-COMPARISON.md) — Functional matrix across Diff, Match (Bitap), and Patch (fuzzy recovery, reverse patching, conflicts).
5. [`BENCHMARK-RESULTS.md`](research/BENCHMARK-RESULTS.md) — Correctness and performance tables across 15 corpus scenarios on Node.js (V8) and Bun (JSC).
6. [`ALGORITHM-EVALUATION.md`](research/ALGORITHM-EVALUATION.md) — Evaluation of Myers, Patience, Histogram, Bitap, Token diffing, and resource bounding.
7. [`ARCHITECTURE-OPTIONS.md`](research/ARCHITECTURE-OPTIONS.md) — Tradeoff analysis of Wrapper, Fork, Hybrid, Rewrite, and Rust/WASM (with empirical FFI measurements).
8. [`IMPLEMENTATION-RECOMMENDATION.md`](research/IMPLEMENTATION-RECOMMENDATION.md) — Definitive selection of **FORK (Fork & Harden `@sanity/diff-match-patch`)** with roadmap, risks, and acceptance criteria.

---

## Quickstart: Reproducing All Empirical Tests

All tests and benchmarks can be executed with **Bun** or **Node.js** (v22+ with `--experimental-strip-types`):

```bash
# 1. Reproduce Upstream Issues
bun run tests/issues/issue-149.ts    # Reproduces Google DMP #149 URIError crash
bun run tests/issues/issue-147.ts    # Evaluates Issue #147 newline patch application
bun run tests/issues/issue-142.ts    # Evaluates Issue #142 semantic diff calculation

# 2. Run Unicode Semantics & Flag Emoji Probe
bun run tests/unicode/unicode-semantics.ts
bun run tests/unicode/probe-flag.ts

# 3. Run Functional Test Suite
bun run tests/functional/functional-tests.ts

# 4. Run Benchmark Correctness & Patch Reconstruction Audit
bun run benchmarks/run-correctness.ts

# 5. Run Performance Benchmarks (Node.js V8 vs Bun JSC)
node --experimental-strip-types benchmarks/run-performance.ts
bun run benchmarks/run-performance.ts

# 6. Run WebAssembly Boundary & Memory Transfer Benchmark
bun run benchmarks/wasm-boundary-test.ts
```
