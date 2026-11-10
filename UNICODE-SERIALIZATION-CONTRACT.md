# Unicode serialization contract (M2 audit)

## Scope and coordinates

TextDiffNext patch headers (`start1`, `start2`, `length1`, `length2`) and delta equality/delete counts use **UTF-16 code units**, as in JavaScript `string.length` and `substring`. No implicit NFC/NFD normalization occurs. The caller may normalize inputs explicitly before diffing; their original code units are otherwise preserved.

Patch text uses Google Diff Match Patch headers and operation lines. The body is based on `encodeURI` / `decodeURI`, with the TextDiffNext extension below. The same codec is used for delta insertion text. A parsed patch can be applied without replacing an unpaired surrogate with U+FFFD.

## TextDiffNext extension for surrogate code units

For each diff chunk, `encodeUriText` passes valid Unicode spans to `encodeURI`. A high surrogate not immediately followed by a low surrogate, or a low surrogate not immediately preceded by a high surrogate, is encoded as literal ASCII `%uXXXX` (four uppercase hex digits in the range D800–DFFF). A valid adjacent pair remains a standard percent encoded UTF-8 sequence. Decoding recognizes `%u` followed by exactly four hex digits in the surrogate range; other escapes are processed by `decodeURI`.

| Original chunk | Encoded body | Decoded chunk |
| --- | --- | --- |
| `🚀` | `%F0%9F%9A%80` | `🚀` |
| lone `\uD800` | `%uD800` | lone `\uD800` |
| lone `\uDC00` | `%uDC00` | lone `\uDC00` |
| six literal characters `%uD800` | `%25uD800` | literal `%uD800` |

`encodeURI` percent encodes literal `%`, so a literal `%uD800` cannot be confused with the extension on the **canonical encoding path**. The decoder is intended for wire text, not arbitrary unencoded user text: passing raw `%uD800` intentionally requests a surrogate. Callers must encode text before constructing a patch/delta line.

Malformed/incomplete escapes (`%`, `%GG`, `%uD8`, `%uD80X`, malformed UTF-8) throw a URI error from the codec; patch parsing surfaces `Illegal escape in parse`. `%u0000` is not a surrogate extension and throws. `%uD8000` deterministically decodes as a lone high surrogate followed by the ordinary `0`. No replacement character is silently inserted. Reserved URI escapes retain the normal `decodeURI` behavior.

## Wire profiles

- **Google-compatible patch:** every emitted chunk is valid Unicode and uses ordinary URI encoding. This profile can be parsed by Google DMP for tested cases.
- **TextDiffNext extended patch:** a chunk contains a lone surrogate and uses `%uXXXX` for that code unit. This profile must be parsed by TextDiffNext; Google DMP rejects the extension.

Input containing literal `%u0000` or `%uD800` is ordinary text in either profile and is serialized as `%25u0000` or `%25uD800`. Both literals have been tested through patch and delta serialization and exact reconstruction.

## Google DMP boundary

`%uXXXX` **is not standard Google DMP encoding**. Google DMP rejects patch lines containing this extension. If every emitted diff chunk is well formed UTF-16, TextDiffNext emits ordinary Google DMP URI encoding, and the tested Google parser/apply accepts it. A source/target string containing only valid Unicode **does not guarantee** every diff chunk will be well formed: edits within a multi-code-point emoji or a ZWJ cluster can split a surrogate pair across diff chunks and trigger `%uXXXX`. Even Google's own serializer can throw on such chunks. Check emitted patch text for `%u` before claiming Google interoperability; test the specific patch with Google DMP when it matters. Internal TextDiffNext serialize → parse → apply supports these chunks and checks exact output.

## Context segmentation

Outer patch context edges are extended to grapheme boundaries when `Intl.Segmenter` is available or supplied through `graphemeSegmenter`. The default Segmenter uses the runtime's ICU data; segmentation can differ between runtime/ICU versions, while coordinate arithmetic and exact replay remain UTF-16 based. Passing `graphemeSegmenter: null` selects a fallback that protects adjacent surrogate pairs at context edges but does not promise full grapheme preservation. This does not move the edit's own boundaries.
