# M3 final audit: package distribution and license readiness

## Release status

**Status:** `PASS (public release ready, not published)`  
**Scope:** Authorized release preparation and validation only. No publication to npm, GitHub releases, or tags was executed.

---

## 1. Executive summary

| Item | Status | Verified detail |
| :--- | :--- | :--- |
| **SPDX license** | PASS | `Apache-2.0` in `package.json` |
| **Root LICENSE** | PASS | Exact official Apache-2.0 text (11,358 bytes, SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`), identical to upstream Google and Sanity snapshots[1] |
| **Upstream attribution** | PASS | `THIRD-PARTY-NOTICES.md` carries Google DMP and Sanity 3.2.1 provenance, author listings, and source lineage[1][3][4] |
| **Source modification notices** | PASS | 9 modified upstream files bear conspicuous top-of-file change notices and Apache-2.0 SPDX identifiers; newly authored utility files bear SPDX identifiers |
| **Package visibility** | PASS | `private: true` removed; public release metadata configured |
| **Runtime dependencies** | PASS | 0 runtime dependencies (`dependencies: {}` omitted from packaged payload) |
| **Tarball composition** | PASS | 40 entries, 39,563 bytes packed (npm 10.9.2), exactly matching required distribution files |
| **Development exclusions** | PASS | `src/`, `tests/`, `upstream-snapshots/`, `benchmarks/`, `node_modules/` excluded |
| **Isolated consumer integration** | PASS | Bun ESM/CJS, Node ESM/CJS, and TypeScript `.mts`/`.cts` (tsc NodeNext) pass without errors against npm tarball |
| **CI workflow** | PASS | `.github/workflows/release-validation.yml` performs test, build, pack, and consumer check without auto-publish |

---

## 2. Source file classification and modification ledger

Comparison of `src/` against `@sanity/diff-match-patch@3.2.1` (`gitHead: 66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6`):[4]

### Unmodified upstream files (21 files)
```text
src/diff/bisect.ts
src/diff/charsToLines.ts
src/diff/cleanup.ts
src/diff/clone.ts
src/diff/commonOverlap.ts
src/diff/commonPrefix.ts
src/diff/commonSuffix.ts
src/diff/compute.ts
src/diff/diffText.ts
src/diff/halfMatch.ts
src/diff/levenshtein.ts
src/diff/lineMode.ts
src/diff/linesToChars.ts
src/diff/xIndex.ts
src/index.ts
src/match/bitap.ts
src/match/match.ts
src/patch/addPadding.ts
src/patch/constants.ts
src/utils/surrogatePairs.ts
src/utils/utf8Indices.ts
```

### Modified upstream-derived files (9 files)
Each file has been tagged with an Apache-2.0 SPDX identifier, upstream derivation, and specific change summary:
- `src/diff/diff.ts`: UTF-16 surrogate boundary handling and diff cleanup.
- `src/diff/fromDelta.ts`: URI delta decoding for isolated UTF-16 surrogates.
- `src/diff/toDelta.ts`: URI delta encoding for isolated UTF-16 surrogates.
- `src/patch/apply.ts`: UTF-16 patch coordinates and grapheme-safe context.
- `src/patch/createPatchObject.ts`: UTF-16 coordinates and deprecated legacy field mirrors.
- `src/patch/make.ts`: UTF-16 patch coordinates and grapheme-safe context.
- `src/patch/parse.ts`: UTF-16 patch coordinates and URI decoding.
- `src/patch/splitMax.ts`: UTF-16 and surrogate-safe patch splitting.
- `src/patch/stringify.ts`: UTF-16 patch coordinates and URI encoding.

### Newly authored files (2 files)
- `src/utils/contextBoundary.ts`: Grapheme-cluster context boundary search; marked with Apache-2.0 SPDX identifier.
- `src/utils/uriText.ts`: Percent-encoding utilities preserving lone surrogate units via `%uXXXX`; marked with Apache-2.0 SPDX identifier.

---

## 3. Package and build verification

### Build outputs
Command: `bun run build` (Exit code: 0)
- `dist/index.js` (ESM): 53,141 bytes, carries upstream license and attribution banner:
  `/*! Copyright 2018 The diff-match-patch Authors. Apache-2.0. Derived from @sanity/diff-match-patch 3.2.1; modified by TextDiffNext. See LICENSE and THIRD-PARTY-NOTICES.md. */`
- `dist/index.cjs` (CJS): 54,613 bytes, carries matching attribution banner.
- `dist/types/index.d.ts` and 31 supporting `.d.ts` files: emitted clean via `tsc -p tsconfig.build.json`.

### Verification test suite
Command: `bun test` (Exit code: 0)
- 44 tests pass across 5 files, 50,111 `expect()` calls.

### Tarball composition (`npm pack --json`)
Command: `npm pack --dry-run --ignore-scripts --json` (Exit code: 0)
- **Archive:** `textdiffnext-0.1.0.tgz`
- **Total files:** 40
- **Packed size:** 39,563 bytes (unpacked: 158,814 bytes)
- **SHA-1:** `df3ac1018ea17f0bd5c8ca5c0d71eec850bfaa17`
- **SHA-512:** `sha512-DiYnQ/MbTb+xkpOTJcqYWyOi/CniARh/kUR5GeD7Q4X1/FKgllGZByM9L9r776xXri9X4ibdsZUcBf4CnDuTkA==`
- **Root documents in tarball:**
  - `package/LICENSE`
  - `package/THIRD-PARTY-NOTICES.md`
  - `package/README.md`
  - `package/API-COMPATIBILITY.md`
  - `package/UNICODE-SERIALIZATION-CONTRACT.md`
  - `package/package.json`

---

## 4. Isolated consumer integration validation

Test script: `tests/m3_consumer_integration.ts` run against both Bun and npm generated tarballs (Exit code: 0).

Environment:
- macOS Darwin 26.6.2 arm64
- Bun v1.4.4
- Node.js v22.14.0
- npm v10.9.2

Verified consumer assertions:
1. **Archive integrity**: `package/package.json` reports `license: "Apache-2.0"`, no `private` property, and empty runtime dependencies. `package/LICENSE` matches root byte-for-byte. Both bundles carry attribution headers.
2. **Clean installation**: Extracted via `bun install --offline --ignore-scripts` into an isolated temporary directory; confirmed installed without symlinks.
3. **ESM consumer (`bun` & `node`)**: Verified 14 named exports (`DIFF_DELETE`, `DIFF_INSERT`, `DIFF_EQUAL`, `DiffMatchPatch`, `diffMatchPatch`, `makeDiff`, `makePatches`, `applyPatches`, `stringifyPatches`, `parsePatch`, `addPaddingToPatches`, `splitMaxPatches`, `createPatchObject`, `computePatchIndex`). Confirmed patch creation, round-trip serialization, and application on complex Unicode strings (`a👩‍🚀%uD800` -> `a👩‍🚀%uD800\uD800`).
4. **CommonJS consumer (`bun` & `node`)**: Verified identical 14 named exports and successful patch application via `require('textdiffnext')`.
5. **TypeScript strict typings**: Validated with `tsc --noEmit --module nodenext --moduleResolution nodenext --target ES2022 --strict` against `.mts` and `.cts` consumer files. 0 errors.

---

## 5. Metadata review and recommendations

1. **Repository / Homepage / Bugs fields**: Kept omitted from `package.json` as requested, because `git config --get remote.origin.url` is unset and no public TextDiffNext repository URL is confirmed. Upstream Google/Sanity URLs must not be substituted.
2. **Npm Scope**: The package name is unscoped (`textdiffnext`), so `publishConfig: { "access": "public" }` is unnecessary and omitted.
3. **CI Pipeline**: Added `.github/workflows/release-validation.yml` which validates tests, builds, declarations, npm tarball creation, and consumer integration. It does not publish to any registry or push git tags.
