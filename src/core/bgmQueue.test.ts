import { describe, expect, it } from 'vitest'
import { bgmIndexAt, bgmOrder, randomBgmSeed } from './bgmQueue'

const COUNT = 66

describe('bgmOrder', () => {
  it('その周に全曲がちょうど一度ずつ入る', () => {
    for (const cycle of [0, 1, 7]) {
      const order = bgmOrder(COUNT, cycle)
      expect(order).toHaveLength(COUNT)
      expect(new Set(order).size).toBe(COUNT)
    }
  })

  it('周ごとに並びが変わる', () => {
    expect(bgmOrder(COUNT, 0)).not.toEqual(bgmOrder(COUNT, 1))
  })

  it('同じ周なら何度呼んでも同じ並び', () => {
    expect(bgmOrder(COUNT, 3)).toEqual(bgmOrder(COUNT, 3))
  })
})

describe('種', () => {
  it('種が違えば並びも違う', () => {
    expect(bgmOrder(COUNT, 0, 1)).not.toEqual(bgmOrder(COUNT, 0, 2))
  })

  it('同じ種なら同じ並び', () => {
    expect(bgmOrder(COUNT, 0, 7)).toEqual(bgmOrder(COUNT, 0, 7))
  })

  it('種が違っても一巡の性質は保たれる', () => {
    for (const seed of [0, 1, 99, 4294967295]) {
      const seen = new Set<number>()
      for (let turn = 0; turn < COUNT; turn++) seen.add(bgmIndexAt(COUNT, turn, seed))
      expect(seen.size).toBe(COUNT)
    }
  })

  it('種が違っても周の変わり目で同じ曲が続かない', () => {
    for (const seed of [0, 1, 99, 4294967295]) {
      for (let cycle = 1; cycle < 8; cycle++) {
        const last = bgmIndexAt(COUNT, cycle * COUNT - 1, seed)
        expect(bgmIndexAt(COUNT, cycle * COUNT, seed)).not.toBe(last)
      }
    }
  })

  it('引き直すたびに違う種が出る', () => {
    const seeds = new Set(Array.from({ length: 40 }, () => randomBgmSeed()))
    expect(seeds.size).toBeGreaterThan(30)
  })
})

describe('bgmIndexAt', () => {
  it('一巡するまで同じ曲を出さない', () => {
    const seen = new Set<number>()
    for (let turn = 0; turn < COUNT; turn++) seen.add(bgmIndexAt(COUNT, turn))
    expect(seen.size).toBe(COUNT)
  })

  it('周の変わり目でも同じ曲が続かない', () => {
    for (let cycle = 1; cycle < 40; cycle++) {
      const last = bgmIndexAt(COUNT, cycle * COUNT - 1)
      const next = bgmIndexAt(COUNT, cycle * COUNT)
      expect(next).not.toBe(last)
    }
  })

  it('何度送っても連続で同じ曲にならない', () => {
    let prev = -1
    for (let turn = 0; turn < COUNT * 5; turn++) {
      const index = bgmIndexAt(COUNT, turn)
      expect(index).not.toBe(prev)
      prev = index
    }
  })

  it('曲数が少なくても破綻しない', () => {
    expect(bgmIndexAt(1, 0)).toBe(0)
    expect(bgmIndexAt(1, 9)).toBe(0)
    expect(bgmIndexAt(2, 0)).toBeLessThan(2)
    expect(bgmIndexAt(0, 3)).toBe(-1)
  })

  it('負の回数でも先頭を返す', () => {
    expect(bgmIndexAt(COUNT, -1)).toBe(bgmIndexAt(COUNT, 0))
  })
})
