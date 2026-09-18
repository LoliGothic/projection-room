import type { Clip, Verdict } from './types'
import { isCorrect } from './types'
import { RULES } from '../config/tuning'

/** 振り返り画面で見せる「間違えた 1 本」 */
export interface Mistake {
  clipId: string
  /** プレイヤーが出した答え */
  verdict: Verdict
  /** 何巻目で間違えたか */
  reel: number
}

/** エンディング判定に使う統計 */
export interface Stats {
  /** 出題した本数（ループをまたいだ累計） */
  presented: number
  /** 正解した本数 */
  correct: number
  /** 第1巻に戻された回数 */
  loops: number
  /** 本物を焼き捨てた回数 */
  burnedReal: number
  /** AI を映写してしまった回数 */
  missedAI: number
  /** リプレイの総回数 */
  replays: number
  /** 不穏タイマーを最後まで進めてしまったか */
  wentDark: boolean
  mistakes: Mistake[]
}

export interface Progress {
  /** 1..RULES.totalReels */
  reel: number
  /** いまの巻で正しくさばいた本数 */
  clearedInReel: number
  stats: Stats
}

/** 回答の結果、次に何が起きるか */
export type Outcome =
  /** 同じ巻の次の 1 本へ */
  | { kind: 'next' }
  /** 巻を通過した。字幕カードを挟んで次の巻へ */
  | { kind: 'reelCleared'; reel: number }
  /** 第8巻を通過した */
  | { kind: 'escaped' }
  /** ミス。第1巻に戻る */
  | { kind: 'loop' }

export function createStats(): Stats {
  return {
    presented: 0,
    correct: 0,
    loops: 0,
    burnedReal: 0,
    missedAI: 0,
    replays: 0,
    wentDark: false,
    mistakes: [],
  }
}

export function createProgress(): Progress {
  return { reel: 1, clearedInReel: 0, stats: createStats() }
}

export function applyAnswer(
  p: Progress,
  clip: Clip,
  verdict: Verdict,
): { progress: Progress; outcome: Outcome } {
  const stats: Stats = { ...p.stats, presented: p.stats.presented + 1 }

  if (!isCorrect(clip, verdict)) {
    // 本物を焼いた / AI を映写した
    if (clip.isAI) stats.missedAI++
    else stats.burnedReal++
    stats.loops++
    stats.mistakes = [...stats.mistakes, { clipId: clip.id, verdict, reel: p.reel }]
    return {
      progress: { reel: 1, clearedInReel: 0, stats },
      outcome: { kind: 'loop' },
    }
  }

  stats.correct++
  const cleared = p.clearedInReel + 1

  if (cleared < RULES.clipsPerReel) {
    return { progress: { ...p, clearedInReel: cleared, stats }, outcome: { kind: 'next' } }
  }

  if (p.reel >= RULES.totalReels) {
    return {
      progress: { reel: p.reel, clearedInReel: cleared, stats },
      outcome: { kind: 'escaped' },
    }
  }

  const reel = p.reel + 1
  return { progress: { reel, clearedInReel: 0, stats }, outcome: { kind: 'reelCleared', reel } }
}

/** リプレイは罰なし。回数だけ数える */
export function applyReplay(p: Progress): Progress {
  return { ...p, stats: { ...p.stats, replays: p.stats.replays + 1 } }
}

/** 不穏タイマーを使い切った（暗闇エンド） */
export function applyDarkness(p: Progress): Progress {
  return { ...p, stats: { ...p.stats, wentDark: true } }
}

/** 1本あたりの平均リプレイ回数。まだ 1 本も出していなければ 0 */
export function averageReplays(stats: Stats): number {
  return stats.presented === 0 ? 0 : stats.replays / stats.presented
}
