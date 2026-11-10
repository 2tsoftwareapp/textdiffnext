import {describe, expect, test} from 'bun:test'
import GoogleDMP from 'diff-match-patch'
import {applyPatches, makePatches, parsePatch, stringifyPatches} from '../src/index.js'

const scenarios = [
  ['Vietnamese', 'Mở đầu: tiếng Việt rất đẹp. Kết thúc.', 'Mở đầu: tiếng Việt thật đẹp. Kết thúc.'],
  ['astral emoji', 'Launch 🚀 now. Status: ready.', 'Launch 🚀 today. Status: ready.'],
  ['CJK', '開始。東京の空は青い。終わり。', '開始。東京の空は赤い。終わり。'],
  ['combining marks', 'Cafe\u0301 and resume\u0301 are here.', 'Cafe\u0301 and re\u0301sume\u0301 are here.'],
  ['CRLF', 'first\r\nsecond\r\nthird\r\n', 'first\r\nsecond changed\r\nthird\r\n'],
  ['special characters', 'a %20 & / ? # + = ~ ! @ : ; $ , [ ] { }\\\tend', 'a %25 & / ? # + = ~ ! @ : ; $ , [ ] { }\\\tend'],
  [
    'multiple Unicode hunks',
    'Prefix Việt Nam café\u0301 🚀 東京\r\n' + 'unmodified line.\r\n'.repeat(12) + 'Suffix 東京 emoji 🚀 end.',
    'Prefix Việt Nam café\u0301 🚀 Hà Nội\r\n' + 'unmodified line.\r\n'.repeat(12) + 'Suffix 東京 emoji 🚀 done.',
  ],
] as const

describe('M1 Google DMP serialized patch interoperability', () => {
  test('emoji substitution: Google serialization limitation, TextDiffNext text remains readable', () => {
    const before = 'Hello 🌍 world!'
    const after = 'Hello 🌏 world!'
    const google = new GoogleDMP()
    expect(() => google.patch_toText(google.patch_make(before, after))).toThrow(URIError)
    const nextText = stringifyPatches(makePatches(before, after))
    expect(applyPatches(parsePatch(nextText), before)[0]).toBe(after)
    expect(google.patch_apply(google.patch_fromText(nextText), before)[0]).toBe(after)
  })

  test("legacy aliases use UTF-16 coordinates and option has no effect", () => {
    const before = '🚀 start. Original text.'
    const after = '🚀 start. Revised text.'
    const patches = makePatches(before, after)
    expect(patches.length).toBeGreaterThan(0)
    for (const patch of patches) {
      expect(patch.utf8Start1).toBe(patch.start1)
      expect(patch.utf8Start2).toBe(patch.start2)
      expect(patch.utf8Length1).toBe(patch.length1)
      expect(patch.utf8Length2).toBe(patch.length2)
    }
    expect(patches.some((patch) => patch.start1 < new TextEncoder().encode(before.slice(0, patch.start1)).length)).toBe(true)
    const parsed = parsePatch(stringifyPatches(patches))
    expect(applyPatches(parsed, before, {allowExceedingIndices: true})).toEqual(
      applyPatches(parsed, before, {allowExceedingIndices: false}),
    )
    expect(applyPatches(parsed, before)[0]).toBe(after)
  })
  for (const [name, before, after] of scenarios) {
    test(name, () => {
      const google = new GoogleDMP()
      const googleText = google.patch_toText(google.patch_make(before, after))
      const parsedByNext = parsePatch(googleText)
      const [nextOutput, nextFlags] = applyPatches(parsedByNext, before)
      expect(nextOutput).toBe(after)
      expect(nextFlags.length).toBeGreaterThan(0)
      expect(nextFlags.every(Boolean)).toBe(true)

      const nextText = stringifyPatches(makePatches(before, after))
      const parsedByGoogle = google.patch_fromText(nextText)
      const [googleOutput, googleFlags] = google.patch_apply(parsedByGoogle, before)
      expect(googleOutput).toBe(after)
      expect(googleFlags.length).toBeGreaterThan(0)
      expect(googleFlags.every(Boolean)).toBe(true)
      if (name === 'multiple Unicode hunks') {
        expect(parsedByNext.length).toBeGreaterThan(1)
        expect(parsedByGoogle.length).toBeGreaterThan(1)
      }
    })
  }
})
