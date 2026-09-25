import { describe, expect, it } from 'vitest'
import type { Clip } from './types'
import {
  applyAnswer,
  applyDarkness,
  applyReplay,
  averageReplays,
  createProgress,
  type Progress,
} from './progress'
import { RULES } from '../config/tuning'

const real: Clip = { id: 'r1', src: 'clips/r1.mp4', isAI: false, category: '自然' }
const ai: Clip = { id: 'a1', src: 'clips/a1.mp4', isAI: true, category: '自然' }

/** n 本正解させる */
function clearClips(p: Progress, n: number): Progress {
  let cur = p
  for (let i = 0; i < n; i++) cur = applyAnswer(cur, real, 'keep').progress
  return cur
}

describe('applyAnswer', () => {
  it('本物を残すと正解', () => {
    const { progress, outcome } = applyAnswer(createProgress(), real, 'keep')
    expect(outcome.kind).not.toBe('loop')
    expect(progress.clearedInStage).toBe(RULES.clipsPerStage === 1 ? 0 : 1)
    expect(progress.stats.correct).toBe(1)
    expect(progress.stats.presented).toBe(1)
  })

  it('AI を報告すると正解', () => {
    const { outcome } = applyAnswer(createProgress(), ai, 'report')
    expect(outcome.kind).not.toBe('loop')
  })

  it('1段階1本なら、1本正解するたびに次の段階へ進む', () => {
    const rules = { totalStages: 8, clipsPerStage: 1 }
    const r = applyAnswer(createProgress(), real, 'keep', rules)
    expect(r.outcome).toEqual({ kind: 'stageCleared', stage: 2 })
    expect(r.progress.stage).toBe(2)
  })

  it('1段階に複数本あるなら、途中は同じ段階に留まる', () => {
    const rules = { totalStages: 8, clipsPerStage: 3 }
    let p = createProgress()
    for (let i = 0; i < 2; i++) {
      const r = applyAnswer(p, real, 'keep', rules)
      expect(r.outcome).toEqual({ kind: 'next' })
      p = r.progress
    }
    expect(applyAnswer(p, real, 'keep', rules).outcome).toEqual({
      kind: 'stageCleared',
      stage: 2,
    })
  })

  it('本物を報告するとミスになり、第1段階に戻る', () => {
    const start = clearClips(createProgress(), RULES.clipsPerStage) // 第2巻へ
    expect(start.stage).toBe(2)

    const { progress, outcome } = applyAnswer(start, real, 'report')
    expect(outcome).toEqual({ kind: 'loop' })
    expect(progress.stage).toBe(1)
    expect(progress.clearedInStage).toBe(0)
    expect(progress.stats.loops).toBe(1)
    expect(progress.stats.reportedReal).toBe(1)
    expect(progress.stats.missedAI).toBe(0)
  })

  it('AI を残してしまってもミスになる', () => {
    const { progress, outcome } = applyAnswer(createProgress(), ai, 'keep')
    expect(outcome).toEqual({ kind: 'loop' })
    expect(progress.stats.missedAI).toBe(1)
    expect(progress.stats.reportedReal).toBe(0)
  })

  it('間違えた動画は振り返り用に記録される', () => {
    const p = clearClips(createProgress(), RULES.clipsPerStage)
    const { progress } = applyAnswer(p, ai, 'keep')
    expect(progress.stats.mistakes).toEqual([{ clipId: 'a1', verdict: 'keep', stage: 2 }])
  })

  it(`1段階 ${RULES.clipsPerStage} 本を正しくさばくと次の段階へ進む`, () => {
    let p = createProgress()
    for (let i = 0; i < RULES.clipsPerStage - 1; i++) {
      const r = applyAnswer(p, real, 'keep')
      expect(r.outcome.kind).toBe('next')
      p = r.progress
    }
    const last = applyAnswer(p, real, 'keep')
    expect(last.outcome).toEqual({ kind: 'stageCleared', stage: 2 })
    expect(last.progress.stage).toBe(2)
    expect(last.progress.clearedInStage).toBe(0)
  })

  it(`第${RULES.totalStages}段階を通過すると脱出になる`, () => {
    const total = RULES.totalStages * RULES.clipsPerStage
    let p = createProgress()
    for (let i = 0; i < total - 1; i++) p = applyAnswer(p, real, 'keep').progress
    expect(p.stage).toBe(RULES.totalStages)

    const last = applyAnswer(p, real, 'keep')
    expect(last.outcome).toEqual({ kind: 'escaped' })
    expect(last.progress.stats.loops).toBe(0)
    expect(last.progress.stats.correct).toBe(total)
  })

  it('ループしても統計は消えない', () => {
    let p = applyAnswer(createProgress(), real, 'report').progress
    p = clearClips(p, 2)
    p = applyAnswer(p, ai, 'keep').progress
    expect(p.stats.loops).toBe(2)
    expect(p.stats.presented).toBe(4)
    expect(p.stats.mistakes).toHaveLength(2)
  })
})

describe('リプレイと不穏タイマー', () => {
  it('リプレイは回数だけ数え、進行には影響しない', () => {
    const p = applyReplay(applyReplay(createProgress()))
    expect(p.stats.replays).toBe(2)
    expect(p.stage).toBe(1)
    expect(p.clearedInStage).toBe(0)
  })

  it('平均リプレイ回数は出題数で割る', () => {
    let p = createProgress()
    p = applyReplay(applyReplay(p))
    expect(averageReplays(p.stats)).toBe(0) // まだ 1 本も回答していない
    p = applyAnswer(p, real, 'keep').progress
    p = applyAnswer(p, real, 'keep').progress
    expect(averageReplays(p.stats)).toBe(1)
  })

  it('暗闇に達したことを記録する', () => {
    expect(applyDarkness(createProgress()).stats.wentDark).toBe(true)
  })
})
