import { describe, expect, it } from 'vitest'
import { buildSlots, slotFor } from './videoRing'

describe('buildSlots', () => {
  it('表示中の1本と先読み分を別々のスロットに割り当てる', () => {
    const slots = buildSlots(0, ['a', 'b', 'c'], 3)
    expect(slots).toEqual(['a', 'b', 'c'])
    expect(new Set(slots).size).toBe(3)
  })

  it('1本進むと、先読み済みの動画は同じスロットに留まる', () => {
    const before = buildSlots(0, ['a', 'b', 'c'], 3)
    const after = buildSlots(1, ['b', 'c', 'd'], 3)
    // b と c は読み込み直しにならない
    expect(after.indexOf('b')).toBe(before.indexOf('b'))
    expect(after.indexOf('c')).toBe(before.indexOf('c'))
    // 消えた a のスロットが d に再利用される
    expect(after.indexOf('d')).toBe(before.indexOf('a'))
  })

  it('何本進んでも重複した割り当てにならない', () => {
    for (let turn = 0; turn < 50; turn++) {
      const ids = [`c${turn}`, `c${turn + 1}`, `c${turn + 2}`]
      const slots = buildSlots(turn, ids, 3)
      expect(slots.filter(Boolean)).toHaveLength(3)
      expect(new Set(slots).size).toBe(3)
    }
  })

  it('先読みがまだ揃っていなければ空きが残る', () => {
    expect(buildSlots(0, ['a'], 3).filter(Boolean)).toEqual(['a'])
  })

  it('スロット数を超える分は無視する', () => {
    expect(buildSlots(0, ['a', 'b', 'c', 'd'], 3).filter(Boolean)).toHaveLength(3)
  })
})

describe('slotFor', () => {
  it('スロット数で循環する', () => {
    expect(slotFor(0, 0, 3)).toBe(0)
    expect(slotFor(2, 1, 3)).toBe(0)
    expect(slotFor(5, 2, 3)).toBe(1)
  })
})
