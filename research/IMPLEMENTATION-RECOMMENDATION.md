# 8. Implementation Recommendation

## Final Architectural Verdict

### Selected Option: **FORK (Fork and Harden `@sanity/diff-match-patch`)**

Based on empirical correctness audits, performance benchmarks across V8 and JavaScriptCore, and end-to-end WebAssembly boundary profiling, the **TextDiffNext** research initiative conclusively selects **FORK** as the only technically and commercially viable development path.

---

## 1. Concrete Evidence Supporting the Verdict

1. **Algorithmic Parity & Battle-Tested Stability:**
   The core diff, match, and patch algorithms in `@sanity/diff-match-patch` are a faithful TypeScript modernization of Neil Fraser’s Google DMP. Google DMP’s algorithmic core achieved **100% reconstruction correctness** across all 15 benchmark scenarios in our test corpus.
2. **Immediate Time-to-Market:**
   Sanity has already performed the laborious translation of Google DMP from monolithic ES5 into clean, typed ES Modules and CommonJS files (`diff/`, `match/`, `patch/`). Forking captures 85% of the required modern infrastructure on Day 1.
3. **Targeted Bug Surface:**
   Our research proved that Sanity DMP’s only fatal flaw is its custom UTF-8 byte offset layer (`adjustIndiciesToUcs2` in `patch/apply.ts`). By excising this layer and restoring native UTF-16 code unit indexing, the library achieves 100% patch reconstruction on long and repetitive files (`Code Long`) while eliminating the `URIError` crash on lone surrogates (Issue #149).
4. **Superior Throughput Without Native/WASM Bloat:**
   Our dual-runtime benchmarks demonstrated that DMP’s line-mode hashing (`diff_linesToChars_`) beats raw `fast-diff` by **10x to 40x on large files** (14.2 ms vs 272.5 ms) and avoids `jsdiff`'s quadratic timeout collapse. Compiling to Rust/WASM proved counterproductive due to memory transfer and FFI boundary overhead.

---

## 2. Explicit Reasons for Rejecting the Other Options

| Disqualified Option | Primary Technical & Commercial Disqualification Reasons |
|---|---|
| **NO-GO** | **Rejected.** The market demand for a reliable, maintained, TypeScript-native text diff/patch library is immense. Google DMP is permanently archived and crashes on Unicode surrogates; Sanity DMP corrupts long repetitive files; jsdiff lacks fuzzy patching; fast-diff is diff-only. TextDiffNext has a clear, uncontested niche as the modern standard. |
| **Wrapper** | **Rejected.** A wrapper around `@sanity/diff-match-patch` cannot repair the internal UTF-8 index drift bug in `applyPatches` without invasive runtime monkey-patching. Wrapping an actively buggy dependency introduces severe liability. |
| **Hybrid Engine** | **Rejected.** Stitching together `fast-diff`'s Myers loop, an external Bitap matcher, and a custom patch engine creates cross-module coordinate translation friction. It increases development scope to 5–6 weeks without exceeding the throughput of Google DMP's line-mode Myers diff. |
| **Full Rewrite** | **Rejected.** Rewriting Myers, Bitap, and fuzzy patch hunk calculation from first principles requires an estimated 12–16 engineer-weeks. Text diffing edge cases (catastrophic backtracking, off-by-one hunk padding, boundary heuristics) take years to stabilize. High capital expenditure with severe regression risk. |
| **Rust / WASM Core** | **Rejected.** Empirical measurements proved that memory allocation and UTF-8 encoding across the JS-to-WASM FFI boundary consumes up to **58.4% of total execution time**. Pure JavaScript running under modern JIT is faster, synchronously accessible, 1/3 the bundle size, and free of CSP/WASM runtime restrictions. |

---

## 3. Scope of Work & Hardening Roadmap (Milestones)

The engineering scope for TextDiffNext as a hardened fork is estimated at **3.5 Engineer-Weeks (140 hours)**:

```
[Milestone 1: Extraction & Index Restoration] (Week 1)
  ├── Fork @sanity/diff-match-patch codebase into TextDiffNext.
  ├── Strip `adjustIndiciesToUcs2`, `utf8Start1`, and `utf8Length1` from patch models.
  ├── Restore pure UTF-16 code unit offset contract across diff, match, and patch.
  └── Verify 100% reconstruction on `corpus/code_long_a.ts` and all 15 corpus files.

[Milestone 2: Unicode & Boundary Hardening] (Week 2)
  ├── Fix Issue #149: Implement safe context margin slicing (never split surrogate pairs).
  ├── Implement RFC 3986 surrogate-safe percent encoder/decoder for patch serialization.
  ├── Integrate `Intl.Segmenter` grapheme cluster boundary alignment in semantic cleanup.
  └── Add explicit normalization pre-processors (`NFC` / `NFD`).

[Milestone 3: Ergonomics, Token Diffing & Diagnostics] (Week 3)
  ├── Add high-level functional and class-based APIs (`diff()`, `patch()`, `fuzzyMatch()`).
  ├── Add word-level and token-aware diffing modes to prevent word splitting (Issue #142).
  ├── Upgrade partial patch application to return structured hunk diagnostics (`HunkResult[]`).
  └── Enforce execution timeouts (`timeoutMs = 1000`) and max diagonal search bounds.

[Milestone 4: Packaging, Dual Runtimes & CI] (Week 4 - 0.5 Weeks)
  ├── Dual ESM + CJS zero-dependency build via `tsup` / `unbuild`.
  ├── Full TypeScript declaration bundle (`.d.ts`).
  ├── Automated CI matrix testing Node.js (18, 20, 22, 26), Bun, and browser (Playwright).
  └── Performance regression benchmark suite integrated into CI.
```

---

## 4. Key Technical Risks & Mitigations

| Identified Risk | Severity | Concrete Mitigation Strategy |
|---|---|---|
| **Surrogate Pair Slicing in Bitap** | High | Extend Bitap to operate on Unicode code points or validate pattern boundaries before bitmask generation. |
| **Repetitive Text False Matches** | Medium | Increase default `Match_Distance` and enforce strict context padding minimums (margin $\ge 8$ chars). |
| **Browser Compatibility without Intl.Segmenter** | Low | Provide lightweight regex fallback for older environments (Node < 16, legacy webviews). |
| **Bundle Size Bloat** | Low | Modular subpath exports (`textdiffnext/diff`, `textdiffnext/match`, `textdiffnext/patch`) ensuring tree-shakeability. |

---

## 5. Formal Acceptance Criteria for Release

Before any production `v1.0.0` release is approved, TextDiffNext must fulfill:

1. **Zero Upstream Bugs:**
   - All 4 Google DMP issues (#149, #147, #143, #142) verified fixed or addressed in automated test suites.
   - Zero `URIError` exceptions when processing strings with lone surrogates or malformed UTF-16.
2. **100% Corpus Pass Rate:**
   - `benchmarks/run-correctness.ts` must pass 15/15 scenarios with bitwise exact round-trip reconstruction, including `Code Long`.
3. **Strict Zero Dependencies:**
   - The production bundle must have 0 npm runtime dependencies.
4. **Performance SLA:**
   - Short inline diffs (< 2 KB) must execute in under **1.0 millisecond** on modern V8/JSC runtimes.
   - Long files (40 KB) must diff in under **25 milliseconds**.
   - Pathological / disjoint files must abort gracefully within the configured timeout (`1000ms`) without freezing the thread.
5. **Cross-Runtime SLA:**
   - Full test suite must pass with 0 failures on Node.js (v18–v26), Bun (v1.0+), Deno, and headless Chromium/Firefox/WebKit.
