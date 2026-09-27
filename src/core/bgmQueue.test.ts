import { describe, expect, it } from 'vitest'
import { bgmIndexAt, bgmOrder } from './bgmQueue'

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
