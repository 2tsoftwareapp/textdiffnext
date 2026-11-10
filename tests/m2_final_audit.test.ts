import {describe, expect, test} from 'bun:test'
// @ts-expect-error The installed Google DMP package has no TypeScript declarations.
import GoogleDMP from 'diff-match-patch'
import {encodeUriText, decodeUriText} from '../src/utils/uriText.js'
import {makePatches, parsePatch, stringifyPatches, applyPatches, makeDiff} from '../src/index.js'
import {diffText1, diffText2} from '../src/diff/diffText.js'
import {doDiff} from '../src/diff/diff.js'
import {toDelta} from '../src/diff/toDelta.js'
import {fromDelta} from '../src/diff/fromDelta.js'

const roundTrip = (before: string, after: string, graphemeSegmenter?: Intl.Segmenter | null) => {
  const patches = makePatches(before, after, {graphemeSegmenter})
  const wire = stringifyPatches(patches)
  const parsed = parsePatch(wire)
  const [actual, applied] = applyPatches(parsed, before)
  expect(actual).toBe(after)
  expect(applied.every(Boolean)).toBe(true)
  expect(parsed).toEqual(patches)
  let rolling = before
  for (const patch of patches) {
    const source = diffText1(patch.diffs)
    const target = diffText2(patch.diffs)
    expect(patch.start1).toBeGreaterThanOrEqual(0)
    expect(patch.start2).toBeGreaterThanOrEqual(0)
    expect(patch.length1).toBe(source.length)
    expect(patch.length2).toBe(target.length)
    expect(rolling.slice(patch.start1, patch.start1 + patch.length1)).toBe(source)
    rolling = rolling.slice(0, patch.start1) + target + rolling.slice(patch.start1 + patch.length1)
  }
  expect(rolling).toBe(after)
  return wire
}

describe('M2 final audit: URI protocol', () => {
  test('literal escape strings and lone surrogates cannot collide', () => {
    const texts = [
      '%u0000', '%uD800', '%uDC00', '%uD800%uDC00', '%25uD800', '%%uD800',
      '\uD800', '\uDC00', '\uD800%uD800\uDC00', '\uDC00\uD800',
      '🚀', 'a🚀\uD800%uDC00z', '%uD8', '%uD80X', '%GG',
    ]
    for (const text of texts) expect(decodeUriText(encodeUriText(text))).toBe(text)
    expect(encodeUriText('%uD800')).toBe('%25uD800')
    expect(decodeUriText('%25uD800')).toBe('%uD800')
    expect(decodeUriText('%uD800')).toBe('\uD800')
    expect(decodeUriText('%uDC00')).toBe('\uDC00')
  })

  test('literal %u0000 and %uD800 survive patch and delta wire formats as ordinary text', () => {
    for (const literal of ['%u0000', '%uD800']) {
      const before = 'a'
      const after = `a${literal}`
      const wire = roundTrip(before, after)
      expect(wire).toContain(`%25${literal.slice(1)}`)
      const diffs = makeDiff(before, after)
      const delta = toDelta(diffs)
      expect(delta).toContain(`%25${literal.slice(1)}`)
      expect(fromDelta(before, delta)).toEqual(diffs)
      expect(diffText2(fromDelta(before, delta))).toBe(after)
    }
  })

  test('every individual UTF-16 code unit survives the codec', () => {
    for (let codeUnit = 0; codeUnit <= 0xFFFF; codeUnit++) {
      const text = String.fromCharCode(codeUnit)
      const decoded = decodeUriText(encodeUriText(text))
      if (decoded !== text) throw new Error(`code unit ${codeUnit.toString(16)} changed`)
    }
  })

  test('malformed or incomplete escapes fail deterministically', () => {
    for (const input of ['%','%u','%uD8','%uD80','%uD80X','%u0000','%GG','%E0%A4%A']) {
      expect(() => decodeUriText(input)).toThrow(URIError)
      expect(() => parsePatch(`@@ -0,0 +1 @@\n+${input}\n`)).toThrow('Illegal escape in parse')
    }
    expect(decodeUriText('%uD8000')).toBe('\uD8000')
  })

  test('valid astral URI data is accepted by Google DMP', () => {
    const google = new GoogleDMP()
    const before = 'a🚀z'
    const after = 'a🚀🌍z'
    expect(encodeUriText('🚀🌍')).toBe(encodeURI('🚀🌍'))
    const wire = roundTrip(before, after)
    expect(google.patch_apply(google.patch_fromText(wire), before)[0]).toBe(after)
    expect(google.patch_toText(google.patch_make(before, after))).not.toContain('%u')
  })

  test('Google rejects TextDiffNext lone surrogate extension', () => {
    const google = new GoogleDMP()
    const wire = roundTrip('az', 'a\uD800z')
    expect(wire).toContain('%uD800')
    expect(() => google.patch_fromText(wire)).toThrow()
  })
})

describe('M2 final audit: context and cleanup', () => {
  test('multiple separated edits retain exact UTF-16 coordinates', () => {
    const before = 'e\u0301abcX_____e\u0301abcY'
    const after = 'e\u0301abcQ_____e\u0301abcR'
    const patches = makePatches(before, after, {margin: 4})
    expect(patches.length).toBe(2)
    expect(patches[0]!.start1).toBe(0)
    expect(patches[0]!.start2).toBe(0)
    expect(patches[0]!.length1).toBe(10)
    expect(patches[1]!.start1).toBe(11)
    expect(patches[1]!.start2).toBe(11)
    expect(patches[1]!.length1).toBe(6)
    expect(patches[0]!.start1 + patches[0]!.length1).toBeLessThanOrEqual(patches[1]!.start1)
    roundTrip(before, after)
  })

  test('grapheme and surrogate fallback both retain exact edits and coordinates', () => {
    const before = 'a👨‍👩‍👧‍👦X123456789👨‍👩‍👧‍👦Yz'
    const after = 'a👨‍👩‍👧‍👦Q123456789👨‍👩‍👧‍👦Rz'
    roundTrip(before, after, new Intl.Segmenter(undefined, {granularity: 'grapheme'}))
    roundTrip(before, after, null)
  })

  test('diff invariants hold for lone and paired surrogates adjacent to BMP', () => {
    for (const [before, after] of [
      ['0\uD800\uDC00', '0\uDC00'],
      ['\uD800\uDC00', '\uD800G\uDC00'],
      ['漢\uD800\uDC00e\u0301', '漢\uDC00Ae\u0301'],
      ['\uDC00a', '\uDC00b'],
    ] as [string, string][]) {
      const diffs = makeDiff(before, after)
      expect(diffText1(diffs)).toBe(before)
      expect(diffText2(diffs)).toBe(after)
      roundTrip(before, after)
    }
  })

  test('ordinary ASCII and BMP diffs remain unchanged by surrogate cleanup', () => {
    for (const [before, after] of [
      ['abc def', 'abc XYZ def'], ['漢字ABC', '漢語ABC'], ['e\u0301 aaa', 'e\u0301 bbb'],
    ] as [string, string][]) {
      expect(makeDiff(before, after)).toEqual(doDiff(before, after, {checkLines: true, deadline: Number.MAX_SAFE_INTEGER}))
      roundTrip(before, after)
    }
  })
})
