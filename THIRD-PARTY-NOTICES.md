# Third-party attributions

TextDiffNext is derived from `@sanity/diff-match-patch@3.2.1`, itself a TypeScript fork of Google's Diff Match Patch. The upstream license is Apache License 2.0; the complete, unmodified license text is distributed in [`LICENSE`](LICENSE). This is a supplemental attribution document: neither the inspected Google snapshot nor the exact Sanity npm 3.2.1 archive includes an upstream file named `NOTICE`.

## Google Diff Match Patch

Original project: https://github.com/google/diff-match-patch

The preserved Google JavaScript source, `upstream-snapshots/google-diff-match-patch/index.js`, states:

> Diff Match and Patch  
> Copyright 2018 The diff-match-patch Authors.  
> https://github.com/google/diff-match-patch  
> Licensed under the Apache License, Version 2.0 (the "License");

The same file names `fraser@google.com (Neil Fraser)` as its author. The Sanity fork's `README.md` preserves `Copyright 2018 The diff-match-patch Authors` and the original project URL. No different copyright years or holders are asserted here. The original Google license text is Apache License 2.0.[1]

## Sanity TypeScript fork

Upstream: https://github.com/sanity-io/diff-match-patch  
Package: `@sanity/diff-match-patch@3.2.1`  
Registry `gitHead`: `66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6`.[4]

The published tarball and preserved snapshot both contain `LICENSE` (Apache-2.0), `AUTHORS`, and `README.md`; the npm metadata says `license: Apache-2.0`. Its `AUTHORS` lists Google Inc., Duncan Cross (Lua port), Jan Weiß (Objective C port), Matthaeus G. Chajdas (C# port), Mike Slemmer (C++ port), and Espen Hovlandsdal (TypeScript port).[3] The `AUTHORS` file identifies contributions to the wider project; this list does not assert that every listed port is embedded in TextDiffNext.

### Source lineage relative to the exact Sanity 3.2.1 snapshot

**Unchanged upstream source (21 files before addition of license headers):**

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

**Modified upstream source (9 files):**

```text
src/diff/diff.ts                 UTF-16 surrogate boundary and cleanup fixes
src/diff/fromDelta.ts            URI decoding for isolated surrogate units
src/diff/toDelta.ts              URI encoding for isolated surrogate units
src/patch/apply.ts               UTF-16 positions and grapheme context
src/patch/createPatchObject.ts   UTF-16 positions and legacy field mirrors
src/patch/make.ts                UTF-16 positions and grapheme context
src/patch/parse.ts               UTF-16 positions and URI decoding
src/patch/splitMax.ts            UTF-16 and surrogate-safe splitting
src/patch/stringify.ts           UTF-16 positions and URI encoding
```

Each modified upstream source file bears a prominent modification header and SPDX identifier. The built ESM and CJS files include an upstream attribution and modification banner. The Apache-2.0 text and this notice are included in the distributable archive. Google-compatible serialization applies to supported standard patches; `%uXXXX` for isolated UTF-16 surrogates is a TextDiffNext extension (see `UNICODE-SERIALIZATION-CONTRACT.md`).

**Paths added relative to the Sanity snapshot:** `src/utils/contextBoundary.ts` and `src/utils/uriText.ts`. They carry the project-selected Apache-2.0 SPDX identifier. Their absence from the Sanity snapshot alone does not establish their copyright owners or rule out derivation from other sources; no individual ownership is claimed.

## Preserved research snapshots outside the npm artifact

`upstream-snapshots/google-diff-match-patch/`, `upstream-snapshots/sanity-diff-match-patch/`, `upstream-snapshots/jsdiff/`, and `upstream-snapshots/fast-diff/` are retained as separate research material in this repository. They are excluded by the package `files` allowlist and are **not** runtime dependencies or part of the npm tarball. Their individual license files remain in their directories: Google and Sanity under Apache-2.0, jsdiff under BSD-3-Clause, and fast-diff under Apache-2.0. This attribution document does not relicense those research snapshots.
