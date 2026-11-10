# M1 API compatibility audit

## Package distribution

TextDiffNext 0.1.0 is prepared for public npm distribution under Apache-2.0, with the full terms in `LICENSE` and upstream attribution in `THIRD-PARTY-NOTICES.md`. The owner authorized release preparation, not publication. ESM and CommonJS expose the same named API through conditional exports; no default export or supported deep import is provided. Both module formats and `.mts`/`.cts` declarations are checked against the generated tarball before release. No new runtime dependency is introduced.

## Patch format and coordinates

`stringifyPatches` and `parsePatch` use the **Google Diff Match Patch patch-text format** (`patch_toText` / `patch_fromText`), not standard line-based Unified Diff. It has `@@ -start,length +start,length @@` headers and URI-escaped, per-operation body lines marked ` `, `-`, or `+`. Unlike Unified Diff, its lengths and positions count JavaScript UTF-16 code units, not lines. The serializer omits `,1` for one unit; zero-length spans use `start,0`. For nonzero spans, the header start is the zero-based object offset plus one. Zero-length spans print the object's offset unchanged. Parsing reverses these rules. `start1`/`length1` refer to source text; `start2`/`length2` refer to destination text. Patch making and application include context in those spans. The numeric values in patch objects are zero-based UTF-16 code-unit coordinates.

The format supports Google patch text for tested cases; it is not a general Unified Diff reader. The Google-compatible wire profile uses standard URI encoding when every emitted diff chunk is valid Unicode. TextDiffNext additionally encodes isolated surrogate code units as `%uXXXX`; Google DMP does not accept that extension. Even valid input strings can produce split-surrogate diff chunks (for example within ZWJ emoji edits), so source text validity alone does not guarantee Google-compatible patch text. The two wire profiles, literal `%uXXXX` handling, and tested interoperability limits are recorded in `UNICODE-SERIALIZATION-CONTRACT.md`.

## Legacy fields

Sanity's public `Patch` interface exposed required `utf8Start1`, `utf8Start2`, `utf8Length1`, and `utf8Length2`; its maker populated byte positions and its serializer used them. TextDiffNext's exported `Patch` interface exposes these as optional, deprecated fields, and `makePatches`/`parsePatch` populate them with **UTF-16 values mirroring** `start1`, `start2`, `length1`, and `length2`. Despite their names they are **not UTF-8 byte offsets or lengths**. For non-ASCII text, consumers using these fields for byte-addressed storage must migrate; this is an intentional semantic incompatibility with Sanity even though the properties remain present. The serializer and application use only the primary UTF-16 fields. Internal `addPadding`, `splitMax`, and `make` also update the legacy mirrors; these fields are not needed by the new coordinate contract.

`adjustIndiciesToUcs2` and `AdjustmentOptions` remain public beta exports in `src/index.ts`. They implement the old byte-to-code-unit conversion and must **not** be called on TextDiffNext patches: doing so treats UTF-16 values as bytes and can corrupt positions. Callers should pass TextDiffNext patches directly to `applyPatches`. Sanity byte-coordinate patch objects or strings need a separate, explicit compatibility conversion based on the original source text; none is provided by M1. A future major version should remove the misleading aliases and beta helper, with a separate adapter only if real byte-coordinate clients require one. Until then, no implicit byte-to-code-unit conversion occurs.

## `allowExceedingIndices`

Original Sanity `applyPatches` passed this option to `adjustIndiciesToUcs2`. When a byte target landed *inside* a multi-byte code point, the helper normally threw `Failed to determine byte offset`; `true` instead accepted the next code-point boundary. When the base string ended before the target, the helper returned the end index **regardless of the option**, so the option never guaranteed strict range checking. This mechanism could clamp or drift patch locations. The option is also accepted by the separately exported legacy helper through `AdjustmentOptions`, where it still has its original behavior.

TextDiffNext `applyPatches` accepts `allowExceedingIndices` through `Partial<ApplyPatchOptions>` but **ignores it** because application no longer converts byte offsets. `true` and `false` produce the same result on the same patch/text. The option does not expand Bitap matching tolerance or ensure success. Callers should remove it; retain as a deprecated no-op until a future breaking release so existing call signatures continue to type-check. Internal application has no call site using it. The only former call site was upstream `patch/apply.ts`; `src/utils/utf8Indices.ts` still reads it for the separately exported helper.

## Verification

`tests/m1_cross_compatibility.test.ts` exercises both serialization directions and asserts exact reconstructed strings and successful flags. It also checks the alias units with an emoji before an edit and checks the no-op application option. These tests do not establish compatibility for legacy Sanity byte-coordinate patch text.
