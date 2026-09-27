import { describe, expect, it } from 'vitest'
import { pickBy, unitHash } from './hash'

describe('unitHash', () => {
  it('同じ入力なら毎回同じ値になる', () => {
    expect(unitHash('abc', 'x')).toBe(unitHash('abc', 'x'))
  })

  it('0以上1未満に収まる', () => {
    for (let i = 0; i < 200; i++) {
      const v = unitHash('clip', String(i))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('末尾1文字しか違わなくても、値が散らばる', () => {
    // ここが弱いと、コメントを続けて引いたときに同じものばかりになる
    const values = Array.from({ length: 12 }, (_, i) => unitHash('abc123', `c${i}`))
    expect(new Set(values).size).toBe(values.length)

    // 12 個の箱に配ったとき、1 つの箱に偏らない
    const buckets = new Set(values.map((v) => Math.floor(v * 12)))
    expect(buckets.size).toBeGreaterThanOrEqual(6)
  })

  it('入力が違えば値も違う', () => {
    expect(unitHash('abc123', 'c0')).not.toBe(unitHash('xyz789', 'c0'))
  })
})

describe('pickBy', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  it('同じ入力なら毎回同じものを選ぶ', () => {
    expect(pickBy(items, 'clip', '3')).toBe(pickBy(items, 'clip', '3'))
  })

  it('続けて引いても同じものばかりにならない', () => {
    const picked = Array.from({ length: 8 }, (_, i) => pickBy(items, 'clip', `c${i}`))
    expect(new Set(picked).size).toBeGreaterThanOrEqual(4)
  })
})
