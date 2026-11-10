# Changelog

All notable changes to this project are documented here.

This format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-10

Initial public release of `textdiffnext`, a UTF-16-native fork of `@sanity/diff-match-patch` 3.2.1.

### Added

- `makeDiff`, `makePatches`, `applyPatches`, `parsePatch`, `stringifyPatches`, `match`, `cleanupSemantic`, `cleanupEfficiency`, and `xIndex`.
- Patch objects and patch text addressed in UTF-16 code units, removing the UTF-8 byte-counting and index-translation layer that upstream ran on every patch operation.
- `%uXXXX` encoding for isolated surrogate halves in patch text, so patches over split surrogates serialize and parse without `URIError`.
- ESM and CommonJS bundles with TypeScript declarations, no runtime dependencies.
- Google DMP patch text interoperability for cases without split surrogates, including `@@ -start,length +start,length @@` headers.
- `API-COMPATIBILITY.md` and `UNICODE-SERIALIZATION-CONTRACT.md`, documenting the coordinate model, the legacy `utf8*` mirrors, the ignored `allowExceedingIndices` option, and the two wire profiles.

### Changed

- `Patch` exposes `start1`, `start2`, `length1`, and `length2` as UTF-16 code units. The legacy `utf8Start1`, `utf8Start2`, `utf8Length1`, and `utf8Length2` fields remain as optional deprecated mirrors holding the same UTF-16 values, not byte offsets.
- `applyPatches` accepts `allowExceedingIndices` and ignores it.

### Deprecated

- `adjustIndiciesToUcs2` and `AdjustmentOptions` remain exported for source compatibility but must not be applied to `textdiffnext` patches.

### Verification

- `bun test` reported 44 passing tests across 5 files.
- `bun run test:consumer` built the tarball and passed ESM, CommonJS, `.mts`, and `.cts` consumer checks on Node.js and Bun.
- The recorded benchmark run reconstructed all 15 corpus scenarios exactly; the upstream Sanity fork corrupted the 45 KB code and 40 KB JSON cases and threw on astral-heavy text. Figures are single-machine and exploratory.
