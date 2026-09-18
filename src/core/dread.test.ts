import { describe, expect, it } from 'vitest'
import { breathLevel, dreadAt, dreadStage, projectorSpeed, silhouetteCloseness } from './dread'
import { DREAD } from '../config/tuning'

const T = DREAD.stagesMs

describe('dreadStage', () => {
  it('しきい値の手前では 0', () => {
    expect(dreadStage(0)).toBe(0)
    expect(dreadStage(T[0] - 1)).toBe(0)
  })

  it('しきい値ちょうどで次の段階に上がる', () => {
    expect(dreadStage(T[0])).toBe(1)
    expect(dreadStage(T[1])).toBe(2)
    expect(dreadStage(T[2])).toBe(3)
    expect(dreadStage(T[3])).toBe(4)
  })

  it('最後のしきい値を超えても段階は増えない', () => {
    expect(dreadStage(T[3] + 60_000)).toBe(T.length)
  })

  it('しきい値は設定から差し替えられる', () => {
    expect(dreadStage(5, [3, 6, 9])).toBe(1)
    expect(dreadStage(9, [3, 6, 9])).toBe(3)
  })
})

describe('dreadAt', () => {
  it('最後の段階に達したときだけ dark になる', () => {
    expect(dreadAt(T[2]).dark).toBe(false)
    expect(dreadAt(T[3]).dark).toBe(true)
  })

  it('強さは単調に増え、0..1 に収まる', () => {
    let prev = -1
    for (let ms = 0; ms <= T[3] + 5_000; ms += 250) {
      const d = dreadAt(ms)
      expect(d.intensity).toBeGreaterThanOrEqual(prev)
      expect(d.intensity).toBeLessThanOrEqual(1)
      prev = d.intensity
    }
  })

  it('開始直後は演出がかからない', () => {
    expect(dreadAt(0).intensity).toBe(0)
    expect(dreadAt(0).stage).toBe(0)
  })

  it('段階内の進み具合を返す', () => {
    const mid = (T[0] + T[1]) / 2
    expect(dreadAt(mid).progress).toBeCloseTo(0.5, 5)
  })
})

describe('段階から決まる演出値', () => {
  it('映写機は段階が進むほど速くなる', () => {
    expect(projectorSpeed(dreadAt(0))).toBe(1)
    expect(projectorSpeed(dreadAt(T[3]))).toBeGreaterThan(projectorSpeed(dreadAt(T[0])))
  })

  it('人影はループ回数でも近づく', () => {
    expect(silhouetteCloseness(dreadAt(0), 0)).toBe(0)
    expect(silhouetteCloseness(dreadAt(0), 20)).toBeGreaterThan(0)
    expect(silhouetteCloseness(dreadAt(T[2]), 20)).toBeGreaterThan(
      silhouetteCloseness(dreadAt(T[0]), 0),
    )
    expect(silhouetteCloseness(dreadAt(T[3]), 99)).toBeLessThanOrEqual(1)
  })

  it('息づかいは最初の段階に入るまで鳴らない', () => {
    expect(breathLevel(dreadAt(0))).toBe(0)
    expect(breathLevel(dreadAt(T[0]))).toBeGreaterThan(0)
  })
})
