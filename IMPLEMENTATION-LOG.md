# TextDiffNext — Milestone 1 Implementation Log

## Context & Scope
- **Project**: TextDiffNext
- **Phase**: Implementation Phase 1: Fork & Index Restoration (Milestone 1)
- **Architecture Selected**: FORK & HARDEN `@sanity/diff-match-patch`
- **Working Tree**: `/Users/truongdq/tx/GitHub/rewrite`

---

## 1. Upstream Provenance & Preservation
- **Upstream Repository**: `https://github.com/sanity-io/diff-match-patch.git`
- **Upstream Package**: `@sanity/diff-match-patch`
- **Upstream Package Version**: `3.2.1`
- **Upstream Git Commit SHA**: `66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6`
- **Upstream License**: Apache-2.0
- **Preserved Snapshot**: `upstream-snapshots/sanity-diff-match-patch/` (immutable copy recorded in `upstream-snapshots/SHASUMS256.txt`)
- **Package.json SHA256**: `dd7eb7ce84414300a9d7f1e98920d9752444b1aa31362307e1bbcae42252e3a4`

---

## 2. Root Cause Investigation & Proof of Offset Corruption

### Theoretical Root Cause
Sanity introduced an experimental UTF-8 translation layer (`src/utils/utf8Indices.ts`) with `countUtf8Bytes` and `adjustIndiciesToUcs2`. The purpose was to emit UTF-8 byte offsets into patch headers (`@@ -start,len +start,len @@`) for backend storage systems.

However, JavaScript string manipulation (`slice`, `substring`, `indexOf`, `match`) inherently operates in **UTF-16 code units**. During patch application (`src/patch/apply.ts`), Sanity invoked `adjustIndiciesToUcs2(patches, text)` which attempted to advance through `text` sequentially from byte 0 to each patch's recorded byte offset.

This caused two catastrophic failure modes:
1. **Accumulated Offset Drift and Out-of-Bounds Clamping**: In multi-hunk documents (such as `code_long_a.ts` and `data_long_a.json`), when `adjustIndiciesToUcs2` encounters a patch whose target offset exceeds the current length of the text base, it clamps `idx` to `base.length`. In `code_long_a.ts`, at patch 103, `start1` and `start2` (21,341) were artificially clamped to `21,158`. This shifted the patch target window into the wrong interface definition, replacing `ServiceHandler_133` instead of `ServiceHandler_135`. The patch application silently declared success (`results[103] = true`), but produced a corrupted file.
2. **Byte Sequence Mid-Point Failure**: If any character is multi-byte in UTF-8 or a surrogate pair in UTF-16 and an offset landed within a sequence, `adjustIndiciesToUcs2` threw `Error: Failed to determine byte offset`, completely crashing patch application.
3. **Surrogate Pair Splitting in Unicode Stringification**: In `src/diff/diff.ts` and `src/diff/cleanup.ts`, Myers diff string splitting and cleanup operate on UTF-16 code units. When an astral character (such as `🌍` `\uD83C\uDF0D`) differs by only the low surrogate, cleanup splits the code units into `\uD83C` (high) and `\uDF0D` (low). Passing lone surrogates into `encodeURI` in `stringifyPatch` throws `URIError: String contained an illegal UTF-16 sequence`.

---

## 3. Code Modifications Applied in Milestone 1

1. **`src/patch/createPatchObject.ts`**:
   - Primary coordinate fields `start1`, `start2`, `length1`, `length2` restored to native JavaScript UTF-16 code units.
   - Preserved `utf8Start1`, `utf8Start2`, `utf8Length1`, `utf8Length2` as deprecated backward-compatible optional fields mirroring the UTF-16 values.
2. **`src/patch/make.ts`**:
   - Removed `countUtf8Bytes` from `_make()` and `addContext()`.
   - Offsets incremented solely by `diffText.length` (UTF-16 code units).
   - Rolling context and prefix/suffix adjustments strictly maintain UTF-16 indices.
3. **`src/patch/stringify.ts`**:
   - Replaced coordinates lookup from `utf8Length` / `utf8Start` to `length` / `start`.
   - Headers output Google DMP standard 1-based UTF-16 code-unit coordinates.
4. **`src/patch/parse.ts`**:
   - Replaced byte-differential calculation (`countUtf8Bytes(line) - line.length`) with direct code-unit lengths.
   - Restored standard Google DMP coordinate parsing.
5. **`src/patch/splitMax.ts`**:
   - Removed `countUtf8Bytes` invocations when splitting oversized patches.
6. **`src/patch/apply.ts`**:
   - Removed invocation of `adjustIndiciesToUcs2`.
   - Replaced with pure `deepCopy(patches)`, leaving UTF-16 coordinates untouched.
   - Retained `allowExceedingIndices` in `ApplyPatchOptions` as a deprecated no-op for signature compatibility.

---

## 4. Verification and Gates Passed

- [x] **Upstream Source Preserved**: Verified immutable snapshot in `upstream-snapshots/`.
- [x] **Root Cause Demonstrated**: Demonstrated that Sanity clamps patch 103 on `code_long_a.ts` from 21,341 to 21,158, producing silent corruption while returning `true`.
- [x] **Exact Reconstruction**: TextDiffNext achieves 100% exact reconstruction across `code_long`, `data_long`, `large_file`, `sparse_edits`, `repetitive_lines`, and all other corpus test cases.
- [x] **Zero Silent Corruption**: All 115 hunks in `code_long` and 240 hunks in `data_long` match expected output byte-for-byte.
- [x] **Cross-Compatibility Verified**: Google DMP patches applied by TextDiffNext pass 100%; TextDiffNext patches applied by Google DMP pass 100%.
- [x] **Regression Suite Created**: `tests/milestone1_regression.test.ts` with 10 test suites and 47 assertions passing cleanly.
