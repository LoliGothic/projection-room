import { describe, expect, it } from 'vitest'
import { commentsFor } from './feed.data'

describe('commentsFor', () => {
  it('同じ動画なら毎回同じ並びになる', () => {
    expect(commentsFor('abc123', 0)).toEqual(commentsFor('abc123', 0))
  })

  it('動画が違えば中身も変わる', () => {
    const a = commentsFor('abc123', 0).map((c) => c.text + c.name).join()
    const b = commentsFor('xyz789', 0).map((c) => c.text + c.name).join()
    expect(a).not.toBe(b)
  })

  it('一度もループしていなければ、穏やかな書き込みだけ', () => {
    const eerie = ['まだ見てるんですか', 'おかえりなさい', 'これ前も流れてきた']
    const texts = commentsFor('abc123', 0).map((c) => c.text)
    expect(texts.some((t) => eerie.includes(t))).toBe(false)
  })

  it('ループが増えるほど、気づいているような書き込みが混ざる', () => {
    const few = commentsFor('abc123', 2).map((c) => c.text)
    const many = commentsFor('abc123', 24).map((c) => c.text)
    const calm = commentsFor('abc123', 0).map((c) => c.text)
    const changed = (list: string[]) => list.filter((t, i) => t !== calm[i]).length
    expect(changed(many)).toBeGreaterThan(changed(few))
  })

  it('指定した件数を返す', () => {
    expect(commentsFor('abc123', 0, 5)).toHaveLength(5)
    expect(commentsFor('abc123', 40, 8)).toHaveLength(8)
  })
})
