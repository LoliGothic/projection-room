import { describe, expect, it } from 'vitest'
import { accountNameFor, captionFor, CROWDING_NAME, stageLabel } from './feed.data'

describe('accountNameFor', () => {
  it('提供者名があればそれを使う', () => {
    expect(accountNameFor('haru_films', 0, 0, 'c1')).toBe('haru_films')
  })

  it('提供者名が空でも、当たり障りのない名前が出る（unknown にしない）', () => {
    const name = accountNameFor('', 0, 0, 'c1')
    expect(name.length).toBeGreaterThan(0)
    expect(name).not.toBe('unknown')
  })

  it('同じ動画なら毎回同じ名前になる', () => {
    expect(accountNameFor('', 0, 0, 'c1')).toBe(accountNameFor('', 0, 0, 'c1'))
  })

  it('ループが増えると同じ名前が混ざるようになる', () => {
    const many = Array.from({ length: 60 }, (_, i) => accountNameFor('haru_films', 24, i, 'c1'))
    const crowded = many.filter((n) => n === CROWDING_NAME).length
    expect(crowded).toBeGreaterThan(0)
    expect(crowded).toBeLessThan(many.length)
  })

  it('一度もループしていなければ置き換わらない', () => {
    const many = Array.from({ length: 30 }, (_, i) => accountNameFor('haru_films', 0, i, 'c1'))
    expect(many.every((n) => n === 'haru_films')).toBe(true)
  })
})

describe('captionFor', () => {
  it('ループが増えるとより不穏な段に変わる', () => {
    const calm = captionFor(0, 0)
    const late = captionFor(20, 0)
    expect(calm).not.toBe(late)
  })

  it('同じ条件なら毎回同じ文言になる', () => {
    expect(captionFor(3, 7)).toBe(captionFor(3, 7))
  })
})

describe('stageLabel', () => {
  it('8段階のうち何段階目かを返す', () => {
    expect(stageLabel(1)).toBe('1 / 8')
    expect(stageLabel(8)).toBe('8 / 8')
  })
})
