# 4. Competitor Functional Comparison

## Executive Summary

This document evaluates the functional capabilities, algorithmic correctness, and failure modes of the four target libraries across three distinct disciplines:
1. **Diff:** Generation of minimal and human-readable edit scripts.
2. **Match:** Approximate / fuzzy string search under drift and typos.
3. **Patch:** Generation, serialization, fuzzy application, and conflict resolution of text hunks.

All empirical findings are derived from `tests/functional/functional-tests.ts`, `tests/issues/`, and our automated test harnesses.

---

## 1. Diff Capability Comparison

| Diff Dimension | `google/diff-match-patch` | `sanity-io/diff-match-patch` | `kpdecker/jsdiff` | `jhchen/fast-diff` |
|---|---|---|---|---|
| **Underlying Algorithm** | Myers ($O(ND)$) + Half-Match Heuristic | Myers + Half-Match Heuristic | Myers ($O(ND)$) | Myers + Half-Match Heuristic |
| **Granularity Options** | Character (Code Unit) | Character (Code Unit) | Chars, Words, Lines, Sentences, JSON | Character (Code Unit) |
| **Semantic Cleanup** | Built-in (`diff_cleanupSemantic`) | Built-in (`cleanupSemantic`) | Manual / Post-process | None |
| **Efficiency Cleanup** | Built-in (`diff_cleanupEfficiency`) | Built-in (`cleanupEfficiency`) | None | None |
| **Execution Timeout Guard** | Built-in (`Diff_Timeout = 1.0s`) | Built-in (`timeout = 1000ms`) | None (Unbounded) | None (Unbounded) |
| **Determinism** | 100% Deterministic | 100% Deterministic | 100% Deterministic | 100% Deterministic |
| **Pathological File Handling** | Drops to heuristic half-match split | Drops to heuristic half-match split | **Hangs / Times Out** ($O(N^2)$) | Unbounded loop risk |

### Diff Determinism & Correctness
In `tests/functional/functional-tests.ts`, 100 repeated runs of all four libraries against identical source texts demonstrated 100% bitwise determinism. Reconstructing the target string from diff outputs succeeded across all four libraries on standard prose and code.

### The Semantic Cleanup Advantage
Raw Myers diff minimizes character edit distance, which often produces fragmented diffs that humans find jarring (e.g. deleting `"ing"` from `"walking"` and inserting `"ed"` leaves `"walk"`, but if applied across similar words it may split words unpredictably).
- **Google DMP & Sanity DMP** include `diff_cleanupSemantic`, which shifts edit boundaries to word boundaries, punctuation, and whitespace.
- **fast-diff** omits cleanup entirely for speed, making it suitable for internal operational transform (OT) engines (e.g. Quill.js) but poor for visual UI diff viewers.

---

## 2. Match (Fuzzy Search) Comparison

Approximate string matching is essential for locating where a patch belongs when the target document has been edited since the patch was created.

| Match Dimension | `google/diff-match-patch` | `sanity-io/diff-match-patch` | `kpdecker/jsdiff` | `jhchen/fast-diff` |
|---|---|---|---|---|
| **Fuzzy Match Engine** | **Bitap Algorithm** (Shift-Or / Shift-And) | **Bitap Algorithm** | **None** | **None** |
| **Location Weighting** | Configurable (`Match_Distance = 1000`) | Configurable (`distance = 1000`) | N/A | N/A |
| **Error Threshold** | Configurable (`Match_Threshold = 0.5`) | Configurable (`threshold = 0.5`) | N/A | N/A |
| **Max Pattern Length** | 32 characters (V8 32-bit bitmask) | 32 characters (bitmask) | N/A | N/A |
| **Multi-line Fuzzy Search** | Yes | Yes | N/A | N/A |

### Bitap Mechanics in Practice
The Bitap algorithm computes Levenshtein edit distance using bitwise arithmetic:
- If a target text shifted forward by 50 characters and had 1 typo introduced, Bitap scores the match based on distance penalty:
  $$\text{Score} = \frac{\text{errors}}{\text{pattern.length}} + \frac{|\text{actual\_loc} - \text{expected\_loc}|}{\text{Match\_Distance}}$$
- If $\text{Score} \le \text{Match\_Threshold}$, the match succeeds.
- Neither `jsdiff` nor `fast-diff` implement fuzzy matching. If an edit offset shifts in `jsdiff`, standard patch application fails unless line context happens to match uniquely.

---

## 3. Patch Generation & Application Comparison

| Patch Dimension | `google/diff-match-patch` | `sanity-io/diff-match-patch` | `kpdecker/jsdiff` | `jhchen/fast-diff` |
|---|---|---|---|---|
| **Patch Engine** | Full (`patch_make`, `patch_apply`) | Full (`makePatches`, `applyPatches`) | Partial (`createPatch`, `applyPatch`) | None |
| **Fuzzy Patching on Drift** | **Supported** (Uses Bitap) | **Supported** (Uses Bitap) | Strict Line Matching only | None |
| **Shifted Source Tolerance** | High (Drifts up to `Match_Distance`) | High (Drifts up to `Match_Distance`) | Fails if line context shifted | None |
| **Partial Failure Reporting** | Returns `[patchedText, [true, false, ...]]` | Returns `[patchedText, [true, false, ...]]` | All-or-nothing (`string \| false`) | None |
| **Patch Serialization** | Custom Unified DMP format | Custom Unified DMP format | Standard GNU Unified Diff | None |
| **Patch Parsing** | `patch_fromText` | `parsePatch` | `parsePatch` | None |
| **Reverse Patching** | Yes (Invert diff op polarity) | Yes (Invert diff op polarity) | Yes (`applyPatch` reverse) | None |
| **Repetitive File Reliability** | **100% Correct** | **CORRUPTS REPETITIVE CODE FILES** | Correct (Line-based) | N/A |

### Empirical Breakdown: Shifted & Drifted Source
In our test scenario (`tests/functional/functional-tests.ts`):
- Source text had 25 characters inserted at the beginning, shifting all subsequent code downwards.
- A patch generated against the original text was applied to the shifted text.
- **Results:**
  - **Google DMP:** Located the shifted block at index 65 (expected 40) and applied the patch cleanly with `results = [true]`.
  - **Sanity DMP:** Successfully applied the patch with `results = [true]`.
  - **jsdiff:** Failed because line offsets did not align.

### Empirical Breakdown: Partial Patch Application
When a multi-hunk patch is applied where Hunk 1 is valid but Hunk 2 conflicts with local edits:
- **Google DMP & Sanity DMP:** Apply Hunk 1 successfully, skip conflicting Hunk 2, and return `[text, [true, false]]`. The caller can inspect which hunk failed and trigger interactive conflict resolution.
- **jsdiff:** Returns `false` for the entire operation, discarding all valid edits.

---

## 4. Conflict Behavior and Pathological Inputs

### Conflict Handling
Neither Google DMP nor Sanity DMP performs three-way merge (`merge3`) out-of-the-box; they perform two-way patch application. If two patches modify overlapping spans:
1. Google DMP applies Patch 1.
2. When applying Patch 2, Bitap searches for the expected context. Because Patch 1 altered that context, the Bitap match score exceeds `Match_Threshold`.
3. Patch 2 fails gracefully (`false`), leaving Patch 1 intact.

### Pathological Input Vulnerabilities
1. **Unbounded Myers in `jsdiff`:**
   Diffing two files of 30,000 characters with zero similarity caused `jsdiff.diffChars` to exceed 5,000ms and trigger timeout aborts. Because Myers explores the edit graph along diagonals $D$, when $D \approx N$ the search area is $O(N^2)$.
2. **Google DMP Timeout Guard:**
   Google DMP tracks `diff_clock = Date.now()`. When execution exceeds `Diff_Timeout` (1.0s), it immediately truncates the Myers search and splits the strings using a half-match heuristic. This guarantees the browser UI thread never freezes indefinitely.
3. **Surrogate Pair Encoding Crash in Google DMP:**
   Google DMP throws an uncaught `URIError` when encoding lone surrogates, crashing the thread.
4. **Offset Translation Drift in Sanity DMP:**
   Sanity DMP silently applies hunks to the wrong line in long files with repeated syntax tokens, causing silent data corruption.
