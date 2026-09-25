import { describe, expect, it } from 'vitest'
import { baseCounters, driftedCounters, formatCount } from './counters'

describe('baseCounters', () => {
  it('同じ動画なら毎回同じ値になる', () => {
    expect(baseCounters('abc123')).toEqual(baseCounters('abc123'))
  })

  it('動画が違えば値も違う', () => {
    expect(baseCounters('abc123').likes).not.toBe(baseCounters('xyz789').likes)
  })

  it('コメントと共有はハートより少ない', () => {
    for (const id of ['a1', 'b2', 'c3', 'd4', 'e5']) {
      const c = baseCounters(id)
      expect(c.comments).toBeLessThan(c.likes)
      expect(c.shares).toBeLessThan(c.comments)
    }
  })
})

describe('driftedCounters', () => {
  it('見ている時間が長いほど数字が増える', () => {
    const base = baseCounters('abc123')
    const a = driftedCounters(base, 10, 1, 14)
    const b = driftedCounters(base, 40, 1, 14)
    expect(a.likes).toBeGreaterThan(base.likes)
    expect(b.likes).toBeGreaterThan(a.likes)
  })

  it('不穏タイマーが進んでいなければ増えない', () => {
    const base = baseCounters('abc123')
    expect(driftedCounters(base, 30, 0, 14)).toEqual(base)
  })
})

describe('formatCount', () => {
  it.each([
    [980, '980'],
    [9_999, '9,999'],
    [12_000, '1.2万'],
    [125_000, '13万'],
    [230_000_000, '2.3億'],
  ])('%i → %s', (n, expected) => {
    expect(formatCount(n)).toBe(expected)
  })
})
