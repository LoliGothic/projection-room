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

const real: Clip = { id: 'r1', src: 'clips/r1.mp4', isAI: false, work: 'w1' }
const ai: Clip = { id: 'a1', src: 'clips/a1.mp4', isAI: true, work: 'g1' }

/** n 本正解させる */
function clearClips(p: Progress, n: number): Progress {
  let cur = p
  for (let i = 0; i < n; i++) cur = applyAnswer(cur, real, 'project').progress
  return cur
}

describe('applyAnswer', () => {
  it('本物を映写すると正解', () => {
    const { progress, outcome } = applyAnswer(createProgress(), real, 'project')
    expect(outcome).toEqual({ kind: 'next' })
    expect(progress.clearedInReel).toBe(1)
    expect(progress.stats.correct).toBe(1)
    expect(progress.stats.presented).toBe(1)
  })

  it('AI を焼き捨てると正解', () => {
    const { outcome } = applyAnswer(createProgress(), ai, 'burn')
    expect(outcome).toEqual({ kind: 'next' })
  })

  it('本物を焼き捨てるとミスになり、第1巻に戻る', () => {
    const start = clearClips(createProgress(), RULES.clipsPerReel) // 第2巻へ
    expect(start.reel).toBe(2)

    const { progress, outcome } = applyAnswer(start, real, 'burn')
    expect(outcome).toEqual({ kind: 'loop' })
    expect(progress.reel).toBe(1)
    expect(progress.clearedInReel).toBe(0)
    expect(progress.stats.loops).toBe(1)
    expect(progress.stats.burnedReal).toBe(1)
    expect(progress.stats.missedAI).toBe(0)
  })

  it('AI を映写してしまってもミスになる', () => {
    const { progress, outcome } = applyAnswer(createProgress(), ai, 'project')
    expect(outcome).toEqual({ kind: 'loop' })
    expect(progress.stats.missedAI).toBe(1)
    expect(progress.stats.burnedReal).toBe(0)
  })

  it('間違えた動画は振り返り用に記録される', () => {
    const p = clearClips(createProgress(), RULES.clipsPerReel)
    const { progress } = applyAnswer(p, ai, 'project')
    expect(progress.stats.mistakes).toEqual([{ clipId: 'a1', verdict: 'project', reel: 2 }])
  })

  it(`1巻 ${RULES.clipsPerReel} 本を正しくさばくと次の巻へ進む`, () => {
    let p = createProgress()
    for (let i = 0; i < RULES.clipsPerReel - 1; i++) {
      const r = applyAnswer(p, real, 'project')
      expect(r.outcome.kind).toBe('next')
      p = r.progress
    }
    const last = applyAnswer(p, real, 'project')
    expect(last.outcome).toEqual({ kind: 'reelCleared', reel: 2 })
    expect(last.progress.reel).toBe(2)
    expect(last.progress.clearedInReel).toBe(0)
  })

  it(`第${RULES.totalReels}巻を通過すると脱出になる`, () => {
    const total = RULES.totalReels * RULES.clipsPerReel
    let p = createProgress()
    for (let i = 0; i < total - 1; i++) p = applyAnswer(p, real, 'project').progress
    expect(p.reel).toBe(RULES.totalReels)

    const last = applyAnswer(p, real, 'project')
    expect(last.outcome).toEqual({ kind: 'escaped' })
    expect(last.progress.stats.loops).toBe(0)
    expect(last.progress.stats.correct).toBe(total)
  })

  it('ループしても統計は消えない', () => {
    let p = applyAnswer(createProgress(), real, 'burn').progress
    p = clearClips(p, 2)
    p = applyAnswer(p, ai, 'project').progress
    expect(p.stats.loops).toBe(2)
    expect(p.stats.presented).toBe(4)
    expect(p.stats.mistakes).toHaveLength(2)
  })
})

describe('リプレイと不穏タイマー', () => {
  it('リプレイは回数だけ数え、進行には影響しない', () => {
    const p = applyReplay(applyReplay(createProgress()))
    expect(p.stats.replays).toBe(2)
    expect(p.reel).toBe(1)
    expect(p.clearedInReel).toBe(0)
  })

  it('平均リプレイ回数は出題数で割る', () => {
    let p = createProgress()
    p = applyReplay(applyReplay(p))
    expect(averageReplays(p.stats)).toBe(0) // まだ 1 本も回答していない
    p = applyAnswer(p, real, 'project').progress
    p = applyAnswer(p, real, 'project').progress
    expect(averageReplays(p.stats)).toBe(1)
  })

  it('暗闇に達したことを記録する', () => {
    expect(applyDarkness(createProgress()).stats.wentDark).toBe(true)
  })
})
