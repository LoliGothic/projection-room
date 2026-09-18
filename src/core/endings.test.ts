import { describe, expect, it } from 'vitest'
import { createStats, type Stats } from './progress'
import { matches, resolveEnding, statValue } from './endings'
import { ENDINGS, ENDING_ORDER, ENDING_THRESHOLDS, type EndingDef } from '../config/endings.data'

function stats(patch: Partial<Stats> = {}): Stats {
  return { ...createStats(), presented: 24, correct: 24, ...patch }
}

describe('statValue', () => {
  it('平均リプレイ回数を導出する', () => {
    expect(statValue(stats({ presented: 10, replays: 25 }), 'avgReplays')).toBe(2.5)
  })

  it('そのままの統計も引ける', () => {
    expect(statValue(stats({ loops: 7 }), 'loops')).toBe(7)
  })
})

describe('matches', () => {
  const s = stats({ loops: 5 })
  it.each([
    ['lt', 6, true],
    ['lt', 5, false],
    ['lte', 5, true],
    ['gt', 4, true],
    ['gte', 5, true],
    ['eq', 5, true],
    ['eq', 4, false],
  ] as const)('%s %d → %s', (op, value, expected) => {
    expect(matches(s, { stat: 'loops', op, value })).toBe(expected)
  })
})

describe('resolveEnding', () => {
  it('一度もループせずに通過すると真エンド', () => {
    expect(resolveEnding(stats({ loops: 0 }), 'escape')?.id).toBe('true')
  })

  it('ループを重ねて通過すると終わらない上映エンド', () => {
    const s = stats({ loops: ENDING_THRESHOLDS.endlessLoops + 1 })
    expect(resolveEnding(s, 'escape')?.id).toBe('endless')
  })

  it('しきい値ちょうどでは終わらない上映にならない', () => {
    const s = stats({ loops: ENDING_THRESHOLDS.endlessLoops })
    expect(resolveEnding(s, 'escape')?.id).toBe('dawn')
  })

  it('リプレイが多いと擦り切れたフィルムエンド', () => {
    const s = stats({
      loops: 3,
      presented: 10,
      replays: 10 * ENDING_THRESHOLDS.wornAvgReplays,
    })
    expect(resolveEnding(s, 'escape')?.id).toBe('worn')
  })

  it('どれにも当てはまらなければ夜明けエンド', () => {
    expect(resolveEnding(stats({ loops: 3 }), 'escape')?.id).toBe('dawn')
  })

  it('不穏タイマーを使い切ったら暗闇エンド', () => {
    expect(resolveEnding(stats({ loops: 0, wentDark: true }), 'darkness')?.id).toBe('darkness')
  })

  it('優先度の小さいものが勝つ（真エンドが終わらない上映より先）', () => {
    // loops 0 は endless の条件を満たさないので、優先度の確認には作った定義を使う
    const defs: EndingDef[] = [
      { ...ENDINGS[0], id: 'later', trigger: 'escape', priority: 50, conditions: [] },
      { ...ENDINGS[0], id: 'earlier', trigger: 'escape', priority: 5, conditions: [] },
    ]
    expect(resolveEnding(stats(), 'escape', defs)?.id).toBe('earlier')
  })

  it('きっかけが違うエンディングは選ばれない', () => {
    expect(resolveEnding(stats(), 'darkness')?.id).toBe('darkness')
    expect(resolveEnding(stats(), 'escape')?.id).not.toBe('darkness')
  })
})

describe('エンディング定義', () => {
  it('ID が重複していない', () => {
    const ids = ENDINGS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('セーブコード用の並びに全エンディングが載っている', () => {
    for (const e of ENDINGS) expect(ENDING_ORDER).toContain(e.id)
    expect(ENDING_ORDER).toHaveLength(ENDINGS.length)
  })

  it('どのエンディングにも字幕カードとヒントがある', () => {
    for (const e of ENDINGS) {
      expect(e.cards.length).toBeGreaterThan(0)
      expect(e.hint.length).toBeGreaterThan(0)
    }
  })

  it('きっかけごとに無条件の受け皿がある（必ずどれかに決まる）', () => {
    for (const trigger of ['escape', 'darkness'] as const) {
      expect(resolveEnding(stats({ loops: 999, replays: 9999 }), trigger)).toBeDefined()
      expect(resolveEnding(createStats(), trigger)).toBeDefined()
    }
  })
})
