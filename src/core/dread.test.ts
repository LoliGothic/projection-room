import { describe, expect, it } from 'vitest'
import {
  ambienceLevel,
  counterDrift,
  dreadAt,
  dreadStage,
  noticeIntervalMs,
  screenBrightness,
} from './dread'
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
  it('画面は段階が進むほど暗くなる', () => {
    expect(screenBrightness(dreadAt(0), 0.62)).toBe(1)
    expect(screenBrightness(dreadAt(T[3]), 0.62)).toBeCloseTo(0.62, 5)
    expect(screenBrightness(dreadAt(T[1]), 0.62)).toBeLessThan(
      screenBrightness(dreadAt(T[0]), 0.62),
    )
  })

  it('数字が増える速さは強さに比例する', () => {
    expect(counterDrift(dreadAt(0))).toBe(0)
    expect(counterDrift(dreadAt(T[3]))).toBe(1)
  })

  it('環境音は最初の段階に入るまで鳴らない', () => {
    expect(ambienceLevel(dreadAt(0))).toBe(0)
    expect(ambienceLevel(dreadAt(T[0]))).toBeGreaterThan(0)
    expect(ambienceLevel(dreadAt(T[3]))).toBeLessThanOrEqual(1)
  })

  it('通知の間隔は強さが上がるほど短くなる', () => {
    const range = [9000, 2600] as const
    expect(noticeIntervalMs(dreadAt(0), range)).toBe(9000)
    expect(noticeIntervalMs(dreadAt(T[3]), range)).toBe(2600)
    expect(noticeIntervalMs(dreadAt(T[1]), range)).toBeLessThan(
      noticeIntervalMs(dreadAt(T[0]), range),
    )
  })
})

describe('暗転の判定', () => {
  it('最後の段階に達したときだけ dark になる', () => {
    expect(dreadAt(T[2]).dark).toBe(false)
    expect(dreadAt(T[3]).dark).toBe(true)
  })
})
