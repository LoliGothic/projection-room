import { describe, expect, it } from 'vitest'
import { intertitleFor, reelLabel, LOOP_CARDS, REEL_CARDS } from './intertitles.data'

describe('intertitleFor', () => {
  it('巻ごとに違う一文を出す', () => {
    const mains = REEL_CARDS.map((_, i) => intertitleFor(i + 1, 0).main)
    expect(new Set(mains).size).toBe(REEL_CARDS.length)
  })

  it('一度もループしていなければ、添える一文は出ない', () => {
    for (let reel = 1; reel <= REEL_CARDS.length; reel++) {
      expect(intertitleFor(reel, 0).sub).toBeUndefined()
    }
  })

  it('第一巻に戻されたときだけ、ループを表す一文が付く', () => {
    expect(intertitleFor(1, 1).sub).toBeTruthy()
  })

  it('2巻目以降には、ループしていても同じ一文を繰り返さない', () => {
    for (let reel = 2; reel <= REEL_CARDS.length; reel++) {
      for (const loops of [1, 5, 12, 30]) {
        expect(intertitleFor(reel, loops).sub).toBeUndefined()
      }
    }
  })

  it('ループが重なるほど段が上がる', () => {
    const at = (loops: number) => intertitleFor(1, loops).sub
    const tiers = LOOP_CARDS.map((t) => t.minLoops)
    const seen = tiers.map((n) => at(n))
    // それぞれの段でその段の文が使われている
    tiers.forEach((minLoops, i) => {
      expect(LOOP_CARDS[i].lines).toContain(seen[i])
    })
    // 段が違えば文も違う
    expect(new Set(seen).size).toBe(tiers.length)
  })

  it('同じ段でも、ループ回数で文が入れ替わる', () => {
    const tier = LOOP_CARDS[0]
    const lines = new Set<string>()
    for (let loops = tier.minLoops; loops < tier.minLoops + tier.lines.length; loops++) {
      lines.add(intertitleFor(1, loops).sub!)
    }
    expect(lines.size).toBe(tier.lines.length)
  })
})

describe('reelLabel', () => {
  it('漢数字で巻を表す', () => {
    expect(reelLabel(1)).toBe('第一巻')
    expect(reelLabel(8)).toBe('第八巻')
  })
})
