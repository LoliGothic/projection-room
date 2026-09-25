import type { Clip, Verdict } from './types'
import { isCorrect } from './types'
import { RULES } from '../config/tuning'

/** 振り返り画面で見せる「間違えた 1 本」 */
export interface Mistake {
  clipId: string
  /** プレイヤーが出した答え */
  verdict: Verdict
  /** 何段階目で間違えたか */
  stage: number
}

/** エンディング判定に使う統計 */
export interface Stats {
  /** 出題した本数（ループをまたいだ累計） */
  presented: number
  /** 正解した本数 */
  correct: number
  /** 第1段階に戻された回数 */
  loops: number
  /** 本物を報告してしまった回数 */
  reportedReal: number
  /** AI を残してしまった回数 */
  missedAI: number
  /** リプレイの総回数 */
  replays: number
  /** 不穏タイマーを最後まで進めてしまったか */
  wentDark: boolean
  mistakes: Mistake[]
}

export interface Progress {
  /** 1..RULES.totalStages */
  stage: number
  /** いまの段階で正しくさばいた本数 */
  clearedInStage: number
  stats: Stats
}

/** 回答の結果、次に何が起きるか */
export type Outcome =
  /** 同じ段階の次の 1 本へ */
  | { kind: 'next' }
  /** 段階を通過した */
  | { kind: 'stageCleared'; stage: number }
  /** 第8段階を通過した */
  | { kind: 'escaped' }
  /** ミス。第1段階に戻る */
  | { kind: 'loop' }

export function createStats(): Stats {
  return {
    presented: 0,
    correct: 0,
    loops: 0,
    reportedReal: 0,
    missedAI: 0,
    replays: 0,
    wentDark: false,
    mistakes: [],
  }
}

export function createProgress(): Progress {
  return { stage: 1, clearedInStage: 0, stats: createStats() }
}

/** 段階の構成。既定は config/tuning.ts の RULES。テストで差し替えられるように受け取る */
export interface StageRules {
  totalStages: number
  clipsPerStage: number
}

export function applyAnswer(
  p: Progress,
  clip: Clip,
  verdict: Verdict,
  rules: StageRules = RULES,
): { progress: Progress; outcome: Outcome } {
  const stats: Stats = { ...p.stats, presented: p.stats.presented + 1 }

  if (!isCorrect(clip, verdict)) {
    // 本物を報告した / AI を残した
    if (clip.isAI) stats.missedAI++
    else stats.reportedReal++
    stats.loops++
    stats.mistakes = [...stats.mistakes, { clipId: clip.id, verdict, stage: p.stage }]
    return {
      progress: { stage: 1, clearedInStage: 0, stats },
      outcome: { kind: 'loop' },
    }
  }

  stats.correct++
  const cleared = p.clearedInStage + 1

  if (cleared < rules.clipsPerStage) {
    return { progress: { ...p, clearedInStage: cleared, stats }, outcome: { kind: 'next' } }
  }

  if (p.stage >= rules.totalStages) {
    return {
      progress: { stage: p.stage, clearedInStage: cleared, stats },
      outcome: { kind: 'escaped' },
    }
  }

  const stage = p.stage + 1
  return {
    progress: { stage, clearedInStage: 0, stats },
    outcome: { kind: 'stageCleared', stage },
  }
}

/** リプレイは罰なし。回数だけ数える */
export function applyReplay(p: Progress): Progress {
  return { ...p, stats: { ...p.stats, replays: p.stats.replays + 1 } }
}

/** 不穏タイマーを使い切った（暗転エンド） */
export function applyDarkness(p: Progress): Progress {
  return { ...p, stats: { ...p.stats, wentDark: true } }
}

/** 1本あたりの平均リプレイ回数。まだ 1 本も出していなければ 0 */
export function averageReplays(stats: Stats): number {
  return stats.presented === 0 ? 0 : stats.replays / stats.presented
}
