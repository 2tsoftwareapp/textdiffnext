import {expect, test} from 'bun:test'
import {makePatches, stringifyPatches, parsePatch, applyPatches, makeDiff} from '../src/index.js'
import {diffText1, diffText2} from '../src/diff/diffText.js'

/** Fixed seed and draws: rerun `bun test tests/m2_fuzz.test.ts`. */
test('M2 deterministic UTF-16 edit and context invariant probe (seed 0x4d325f41)', () => {
  const atoms = [
    'a', 'b', '漢', 'e\u0301', '👩‍🚀', '👨‍👩‍👧‍👦', '👍🏽', '\r\n',
    '\uD800', '\uDC00', '%uD800', '%uDC00', '%GG', '\u200D',
  ]
  let seed = 0x4d325f41
  const draw = (size: number) => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % size)
  const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'})
  for (let iteration = 0; iteration < 1600; iteration++) {
    const chunks = Array.from({length: 8 + draw(9)}, () => atoms[draw(atoms.length)]!)
    const before = chunks.join('')
    const afterChunks = chunks.slice()
    for (let edit = 0, count = 1 + draw(3); edit < count; edit++) {
      afterChunks.splice(draw(afterChunks.length + 1), draw(3), atoms[draw(atoms.length)]!)
    }
    const after = afterChunks.join('')
    const diffs = makeDiff(before, after)
    expect(diffText1(diffs), `iteration=${iteration} before=${JSON.stringify(before)}`).toBe(before)
    expect(diffText2(diffs), `iteration=${iteration} after=${JSON.stringify(after)}`).toBe(after)
    for (const graphemeSegmenter of [undefined, null, segmenter]) {
      const patches = makePatches(before, after, {graphemeSegmenter})
      const wire = stringifyPatches(patches)
      const [actual, applied] = applyPatches(parsePatch(wire), before)
      expect(actual, `iteration=${iteration} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`).toBe(after)
      expect(applied.every(Boolean)).toBe(true)
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
    }
  }
})
