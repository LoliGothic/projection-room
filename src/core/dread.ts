import { DREAD } from '../config/tuning'

/**
 * 不穏タイマー。1 本の動画が表示されてからの経過時間だけで決まる純粋な計算。
 * 数字は画面に出さず、段階（stage）と段階内の進み具合（progress）で演出を動かす。
 *
 * stage 0        しきい値に達していない
 * stage 1..n-1   段階演出
 * stage n        最後まで達した = 暗転エンド
 */
export interface Dread {
  /** 0..stagesMs.length */
  stage: number
  /** いまの段階の中での進み具合 0..1 */
  progress: number
  /** 演出の強さ 0..1（段階と段階内の進み具合をなめらかにつないだもの） */
  intensity: number
  /** 最後まで達したか */
  dark: boolean
}

export function dreadStage(elapsedMs: number, thresholds: readonly number[] = DREAD.stagesMs): number {
  let stage = 0
  for (const t of thresholds) {
    if (elapsedMs >= t) stage++
    else break
  }
  return stage
}

export function dreadAt(elapsedMs: number, thresholds: readonly number[] = DREAD.stagesMs): Dread {
  const stage = dreadStage(elapsedMs, thresholds)
  const dark = stage >= thresholds.length

  const from = stage === 0 ? 0 : thresholds[stage - 1]
  const to = thresholds[Math.min(stage, thresholds.length - 1)]
  const span = Math.max(1, to - from)
  const progress = dark ? 1 : Math.min(1, Math.max(0, (elapsedMs - from) / span))

  // 段階の強さの間をなめらかに補間する。段階0は「強さ0」から始める
  const levels = [0, ...DREAD.intensity]
  const lo = levels[Math.min(stage, levels.length - 1)]
  const hi = levels[Math.min(stage + 1, levels.length - 1)]
  const intensity = Math.min(1, lo + (hi - lo) * progress)

  return { stage, progress, intensity, dark }
}

/** 画面の明るさ。段階が進むほど落ちる */
export function screenBrightness(d: Dread, floor: number): number {
  return 1 - (1 - floor) * d.intensity
}

/** ハートやコメント数が勝手に増える速さの倍率 */
export function counterDrift(d: Dread): number {
  return d.intensity
}

/** 低い環境音の大きさ 0..1。最初の段階に入るまでは鳴らさない */
export function ambienceLevel(d: Dread): number {
  return d.stage === 0 ? 0 : Math.min(1, (d.intensity - 0.15) / 0.85)
}

/** 通知が届く間隔（ms）。強さが上がるほど短くなる */
export function noticeIntervalMs(d: Dread, range: readonly [number, number]): number {
  return range[0] + (range[1] - range[0]) * d.intensity
}
