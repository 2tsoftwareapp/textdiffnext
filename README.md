<div align="center">

# 📝 textdiffnext

### UTF-16-native diff, match and patch for JavaScript

[![version](https://img.shields.io/badge/version-0.1.0-blue.svg?style=flat-square)](package.json)
[![license](https://img.shields.io/badge/license-Apache--2.0-green.svg?style=flat-square)](LICENSE)
[![tests](https://img.shields.io/badge/tests-44%20passing-brightgreen.svg?style=flat-square)](tests/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933.svg?style=flat-square)](package.json)

**A hardened fork of `@sanity/diff-match-patch`, with patch coordinates that match JavaScript string indices.**

[Install](#install) · [Usage](#usage) · [API](#api) · [Contracts](#coordinate-and-format-contracts) · [Performance](#recorded-performance)

</div>

---

## Why this fork exists

`diff-match-patch` and its TypeScript fork `@sanity/diff-match-patch` express patch coordinates as **UTF-8 byte offsets**. JavaScript strings are indexed in **UTF-16 code units**. The Sanity fork bridged the two with a byte-counting and index-translation layer that runs on every patch operation, and that layer is where the recorded failures come from: patch offset clamping on long multi-hunk files, cumulative drift on large JSON documents, and `Failed to determine byte offset` exceptions on astral text.

`textdiffnext` removes that layer. Patch objects, patch text, and the public API all speak UTF-16 code-unit coordinates — the same units as `string.prototype.length` and `slice()`.

| Problem | What this package does |
| --- | --- |
| Patch coordinates drift from JavaScript string indices | Coordinates are UTF-16 code units end to end; no byte-to-code-unit translation runs during make, apply, or serialize. |
| Lone surrogate halves crash `encodeURI` during patch serialization | Isolated surrogate code units are emitted as `%uXXXX` and parsed back losslessly. |
| Applying a patch to shifted text silently clamps or corrupts | Bitap fuzzy matching works on code-unit positions; the recorded 45 KB and 40 KB corruption cases reconstruct exactly. |
| Patch text must interoperate with existing tooling | The wire format is Google DMP patch text (`patch_toText` / `patch_fromText`), including `@@ -start,length +start,length @@` headers. |

This is a fork, not a rewrite of the algorithm: the Myers bisect, semantic cleanup, and Bitap matcher are the upstream implementations. What changed is the coordinate model and the Unicode hardening around it.

## Install

```sh
npm install textdiffnext
```

Requires Node.js 22 or later. The package ships ESM, CommonJS, and TypeScript declarations, and has no runtime dependencies.

## Usage

```ts
import { makeDiff, makePatches, stringifyPatches, parsePatch, applyPatches } from 'textdiffnext';

const source = 'The quick brown fox';
const target = 'The quick red fox';

const diffs = makeDiff(source, target);
const patches = makePatches(source, target);

const patchText = stringifyPatches(patches);      // portable patch text
const [result, applied] = applyPatches(parsePatch(patchText), source);

// result === target, applied.every(Boolean) === true
```

CommonJS works the same way:

```js
const { makeDiff, makePatches, applyPatches } = require('textdiffnext');
```

Fuzzy application is available when the target text has shifted:

```ts
import { makePatches, applyPatches } from 'textdiffnext';

const patches = makePatches('aaaa\nbbbb\ncccc', 'aaaa\nBBBB\ncccc');
const [result, applied] = applyPatches(patches, 'header line\naaaa\nbbbb\ncccc');
```

## API

| Export | Description |
| --- | --- |
| `makeDiff(textA, textB, options?)` | Compute diff tuples `[type, text]` using `DIFF_DELETE`, `DIFF_INSERT`, `DIFF_EQUAL`. |
| `makePatches(textA, textB, options?)` | Build `Patch[]` from two texts, or from an existing `Diff[]`. |
| `applyPatches(patches, text, options?)` | Apply patches, returning `[text, boolean[]]`; the flags report which patches matched. |
| `parsePatch(patchText)` | Parse Google DMP patch text into `Patch[]`. |
| `stringifyPatches(patches)` | Serialize `Patch[]` to Google DMP patch text. |
| `match(text, pattern, searchLocation, options?)` | Bitap fuzzy match; returns the best match index or `-1`. |
| `cleanupSemantic(diffs)` / `cleanupEfficiency(diffs)` | Upstream diff cleanup passes. |
| `xIndex(text1, text2)` | Locate the shared middle segment used by the bisect step. |
| `adjustIndiciesToUcs2(patches, base, options?)` | Deprecated beta helper kept for source compatibility; do not use it on `textdiffnext` patches (see below). |

`Patch` exposes `start1`, `start2`, `length1`, and `length2` as zero-based UTF-16 code-unit coordinates. The legacy `utf8Start1` / `utf8Start2` / `utf8Length1` / `utf8Length2` fields remain as optional deprecated mirrors holding the same UTF-16 values — they are **not** byte offsets. `applyPatches` accepts `allowExceedingIndices` for call-signature compatibility and ignores it.

## Coordinate and format contracts

- **Coordinates:** UTF-16 code units, zero-based, for both patch objects and patch text.
- **Patch text:** Google DMP format, not Unified Diff. `@@ -start,length +start,length @@` headers count code units, not lines; nonzero span starts are the zero-based offset plus one.
- **Surrogates:** isolated surrogate halves serialize as `%uXXXX`. Google DMP rejects that extension, so patch text containing split surrogates is not Google-compatible even when the source text was valid Unicode.
- **Legacy byte clients:** no implicit byte-to-code-unit conversion is performed. Byte-coordinate patches from Sanity need an explicit conversion based on the original source text.

Details and tested limits: [API-COMPATIBILITY.md](API-COMPATIBILITY.md) and [UNICODE-SERIALIZATION-CONTRACT.md](UNICODE-SERIALIZATION-CONTRACT.md).

## Recorded performance

The repository benchmark log records one exploratory run on a single machine (macOS arm64, Bun 1.4.4) using the full patch pipeline (`makePatches` + `applyPatches`) on a 45 KB multi-hunk TypeScript file:

| Implementation | p50 | p95 |
| --- | ---: | ---: |
| `textdiffnext` | 7.12 ms | 19.91 ms |
| `@sanity/diff-match-patch` 3.2.1 | 8.64 ms | 23.92 ms |

That run also recorded exact reconstruction on all 15 corpus scenarios, where the Sanity fork corrupted the 45 KB code and 40 KB JSON cases and threw on astral-heavy text. These are single-machine, single-run figures with warm-up discarded; they are not a throughput guarantee. See [BENCHMARK-RESULTS.md](https://github.com/2tsoftwareapp/textdiffnext/blob/main/BENCHMARK-RESULTS.md) and [REGRESSION-RESULTS.md](https://github.com/2tsoftwareapp/textdiffnext/blob/main/REGRESSION-RESULTS.md).

## Development

```sh
bun install --frozen-lockfile
bun test                 # 44 tests
bun run build            # dist/index.js, dist/index.cjs, dist/types
bun run test:consumer    # tarball + isolated ESM/CJS/types consumers
```

The build requires Bun 1.4.4 or later; earlier Bun releases do not resolve `.js` import specifiers to `.ts` sources, which silently produces empty bundles.

## Research artifacts

The feasibility study behind this fork — upstream snapshots, issue reproductions, Unicode semantics, competitor matrix, algorithm evaluation, and architecture options — is indexed in [research/README.md](https://github.com/2tsoftwareapp/textdiffnext/blob/main/research/README.md). Those documents are engineering records, not package documentation.

## License

Apache-2.0. Derived from [`@sanity/diff-match-patch`](https://github.com/sanity-io/diff-match-patch) 3.2.1, itself a TypeScript fork of [Google diff-match-patch](https://github.com/google/diff-match-patch). Upstream attribution is in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
