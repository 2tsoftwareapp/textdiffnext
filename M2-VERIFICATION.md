# M2 Unicode Hardening Report

## Executive Summary
Milestone 2 hardens TextDiffNext for Unicode correctness under the active constraints:
1. **Coordinate System**: Preserved UTF-16 code units across all internal diff/patch operations.
2. **Context Slicing**: Slices outer patch context along grapheme cluster boundaries when available, falling back safely to surrogate preservation without modifying the core Myers diff logic.
3. **Serialization Contract**: Serializes valid Unicode text using standard URI encoding and lone/unpaired UTF-16 surrogates via explicit `%uXXXX` escape sequences. This prevents `URIError: String contained an illegal UTF-16 sequence` and round-trips exactly.
4. **Intl.Segmenter Decoupling**: Slicing defaults to `Intl.Segmenter` when present, but supports callers explicitly passing `graphemeSegmenter: null` to run on environments without the API.
5. **Opt-in Normalization**: Zero implicit NFC/NFD calls are introduced in the source tree; canonical normalization remains under explicit caller control.
6. **Regression Verification**: Exact-text assertions confirm that round-trip operations (`before` -> patch -> stringify -> parse -> apply) reconstruct `after` verbatim across complex emojis, ZWJ sequences, skin tones, combining marks, surrogate edges, and mixed samples.

---

## Technical Implementations

### 1. Lone Surrogate & Astral Serialization Contract
- **File**: `src/utils/uriText.ts`
- **Encoding Rule**:
  - Matches chunks of valid Unicode and passes them to standard `encodeURI`.
  - Encodes isolated UTF-16 high surrogates (`0xD800-0xDBFF`) and low surrogates (`0xDC00-0xDFFF`) as `%uXXXX`.
  - Escapes literal `%uXXXX` instances in source text to avoid ambiguity.
- **Decoding Rule**:
  - Replaces `%uXXXX` sequences back into lone code units before standard decoding.
- **Interoperability**:
  - When text contains valid astral symbols without split surrogates, serialized output remains 100% compliant with standard Google DMP parsers.
  - When diff cleanup produces lone surrogates across chunks, TextDiffNext serializes and parses safely, avoiding serialization errors. Google DMP will reject `%uXXXX` explicitly rather than silently corrupting data.

### 2. Grapheme Context Boundary
- **File**: `src/utils/contextBoundary.ts`
- **Module**: `src/patch/make.ts`
- `addContext` inspects prefix and suffix boundaries using `opts.graphemeSegmenter`.
- If an edit boundary lands inside a combining sequence or grapheme cluster, the context edge expands outward to encompass the whole grapheme.
- When `graphemeSegmenter` is null or unavailable, it guarantees that UTF-16 surrogate pairs are never severed.
- Core diff boundaries are not arbitrarily mutated.

### 3. Isolation of Surrogate Cleanups
- **File**: `src/diff/diff.ts`
- `adjustDiffForSurrogatePairs` was hardened so that `deisolateChar` only runs when a surrogate is genuinely paired with an opposite surrogate across the diff chunk boundary.
- Unpaired/lone surrogates at text edges are left in their original position, resolving silent corruption when lone surrogates abut CJK characters or other boundaries.

---

## Verification Results

### Test Suite (`bun test`)
- Total: **30 passed, 0 failed, 292 assertions across 3 test files**.
- `tests/m2_unicode_hardening.test.ts`:
  - 11 dedicated tests covering lone surrogates, ZWJ family sequences, combining character clusters, fallback without `Intl.Segmenter`, opt-in normalization invariants, delta representation, and 48 deterministic mixed-Unicode permutations.
- `tests/m1_cross_compatibility.test.ts`:
  - 8 tests passing with Google DMP bidirectional checks.
- `tests/milestone1_regression.test.ts`:
  - 11 regression tests passing.
- Deterministic fuzz run:
  - 800 random mixed Unicode edits with emojis, combining marks, lone surrogates, and line breaks completed with **0 failures**.

### Type Check Audit (`bun check --all`)
- Total diagnostics observed in the earlier M2 run: 1,155 across 52 files. That count alone does not establish an unchanged M1 baseline; see `M2-TYPECHECK-BASELINE.md` for the final audit.
- A directory count cannot establish that `src/` diagnostics were inherited from upstream. Do not treat the 243 `src/` diagnostics as pre-existing without a file-by-file baseline comparison.
