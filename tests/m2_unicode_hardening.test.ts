import {describe, expect, test} from 'bun:test'
// @ts-expect-error The installed Google DMP package ships without TypeScript declarations.
import GoogleDMP from 'diff-match-patch'
import {applyPatches, makePatches, parsePatch, stringifyPatches} from '../src/index.js'
import {toDelta} from '../src/diff/toDelta.js'
import {fromDelta} from '../src/diff/fromDelta.js'
import {DIFF_EQUAL, DIFF_INSERT} from '../src/diff/diff.js'
import {diffText1, diffText2} from '../src/diff/diffText.js'
import {makeDiff} from '../src/index.js'

function roundTrip(before: string, after: string): string {
  const serialized = stringifyPatches(makePatches(before, after))
  const [output, applied] = applyPatches(parsePatch(serialized), before)
  expect(applied.length).toBeGreaterThan(0)
  expect(applied.every(Boolean)).toBe(true)
  expect(output).toBe(after)
  return serialized
}

describe('M2 context grapheme boundaries', () => {
  test('default context expands to include a complete combining cluster', () => {
    const before = 'e\u0301abcX'
    const after = 'e\u0301abcY'
    const patches = makePatches(before, after, {margin: 4})
    expect(patches[0]!.start1).toBe(0)
    expect(patches[0]!.diffs[0]).toEqual([DIFF_EQUAL, 'e\u0301abc'])
    expect(applyPatches(parsePatch(stringifyPatches(patches)), before)[0]).toBe(after)
  })

  test('suffix context includes the entire combining cluster', () => {
    const before = 'Xabce\u0301Z'
    const after = 'Yabce\u0301Z'
    const patches = makePatches(before, after, {margin: 4})
    expect(patches[0]!.diffs.at(-1)).toEqual([DIFF_EQUAL, 'abce\u0301'])
    expect(applyPatches(parsePatch(stringifyPatches(patches)), before)[0]).toBe(after)
  })

  test('fallback keeps UTF-16 surrogate pairs intact without Segmenter', () => {
    const before = '👍🏽abcX'
    const after = '👍🏽abcY'
    const patches = makePatches(before, after, {margin: 4, graphemeSegmenter: null})
    expect(patches[0]!.start1).toBe(2)
    expect(patches[0]!.diffs[0]).toEqual([DIFF_EQUAL, '🏽abc'])
    expect(applyPatches(parsePatch(stringifyPatches(patches)), before)[0]).toBe(after)
  })
})

describe('M2 normalization and mixed Unicode exactness', () => {
  test('unpaired low surrogate at a common prefix does not corrupt a diff', () => {
    const before = '\uDC00a'
    const after = '\uDC00b'
    const diffs = makeDiff(before, after)
    expect(diffText1(diffs)).toBe(before)
    expect(diffText2(diffs)).toBe(after)
    roundTrip(before, after)
  })

  test('shared low surrogate after a deleted high surrogate remains exact', () => {
    const before = '\uD800\uDC00'
    const after = '\uDC00'
    const diffs = makeDiff(before, after)
    expect(diffText1(diffs)).toBe(before)
    expect(diffText2(diffs)).toBe(after)
    roundTrip(before, after)
  })

  test('insertion between surrogate halves does not reorder text', () => {
    const before = '\uD800\uDC00'
    const after = '\uD800G\uDC00'
    const diffs = makeDiff(before, after)
    expect(diffText1(diffs)).toBe(before)
    expect(diffText2(diffs)).toBe(after)
    roundTrip(before, after)
  })

  test('a common ASCII prefix keeps a low-surrogate insertion in place', () => {
    const before = '0\uD800\uDC00'
    const after = '0\uDC00'
    const diffs = makeDiff(before, after)
    expect(diffText1(diffs)).toBe(before)
    expect(diffText2(diffs)).toBe(after)
    roundTrip(before, after)
  })

  test('NFC and NFD are caller-controlled; patching preserves original code units', () => {
    const before = 'Cafe\u0301 🇻🇳'
    const after = 'Café 🇻🇳'
    expect(before).not.toBe(after)
    roundTrip(before, after)
    expect(makePatches(before.normalize('NFC'), after.normalize('NFC'))).toEqual([])
    expect(makePatches(before.normalize('NFD'), after.normalize('NFD'))).toEqual([])
  })

  test('mixed Unicode edits reconstruct exactly over deterministic samples', () => {
    const atoms = ['a', 'e\u0301', '👨‍👩‍👧‍👦', '👍🏽', '🇻🇳', '東京', '\r\n', '\uD800', '\uDC00', '%uD800']
    let seed = 123456789
    const draw = (size: number) => ((seed = (1664525 * seed + 1013904223) >>> 0) % size)
    for (let sample = 0; sample < 48; sample++) {
      const parts = Array.from({length: 10}, () => atoms[draw(atoms.length)]!)
      const before = parts.join('')
      const changed = parts.slice()
      changed.splice(draw(parts.length), 1, atoms[draw(atoms.length)]!)
      const after = changed.join('')
      if (before !== after) roundTrip(before, after)
    }
  })
})

describe('M2 Unicode serialization contract', () => {
  test('ZWJ family edit with split surrogate code units reconstructs exactly', () => {
    const before = 'Gia đình: 👨‍👩‍👧‍👦!'
    const after = 'Gia đình: 👨‍👩‍👦!'
    const serialized = roundTrip(before, after)
    expect(serialized).toContain('%uD83D')
    expect(serialized).toContain('%uDC67')
    const google = new GoogleDMP()
    expect(() => google.patch_fromText(serialized)).toThrow()
  })

  test('unpaired high and low surrogates round-trip without replacement characters', () => {
    for (const after of ['x\uD800y', 'x\uDC00y', 'x\uD800%uD800y']) {
      const serialized = roundTrip('xy', after)
      expect(serialized).not.toContain('\uFFFD')
    }
  })

  test('malformed escape remains an error', () => {
    expect(() => parsePatch('@@ -0,0 +1 @@\n+%uD80X\n')).toThrow()
    expect(() => parsePatch('@@ -0,0 +1 @@\n+%GG\n')).toThrow()
  })

  test('delta insertion uses the same reversible escape contract', () => {
    const diffs = [[DIFF_EQUAL, 'a'], [DIFF_INSERT, '\uD800%uD800']] as [typeof DIFF_EQUAL | typeof DIFF_INSERT, string][]
    const delta = toDelta(diffs)
    expect(delta).toContain('%uD800')
    expect(fromDelta('a', delta)).toEqual(diffs)
  })

  test('valid Unicode and percent sequences keep Google DMP interoperability', () => {
    const before = 'Mở đầu: 🚀 Tokyo 東京 cafe\u0301!'
    const after = 'Mở đầu: 🚀 Hà Nội 東京 cafe\u0301!'
    const serialized = roundTrip(before, after)
    const google = new GoogleDMP()
    expect(google.patch_apply(google.patch_fromText(serialized), before)[0]).toBe(after)
    const googleText = google.patch_toText(google.patch_make(before, after))
    expect(applyPatches(parsePatch(googleText), before)[0]).toBe(after)
  })
})
