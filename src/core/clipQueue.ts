import type { Clip } from './types'
import type { Rng } from './rng'
import { RULES } from '../config/tuning'

/**
 * 出題の選択。UI から完全に独立した純粋関数。
 *
 * 制約:
 *  1. 1回のプレイ中は同じ動画を繰り返さない（在庫が尽きたら出題済みをリセット）
 *  2. 同じ種類（本物/AI）が 5 本以上連続しない
 *  3. 同じ元作品の場面が連続しない
 *
 * 制約を全部満たす候補が 0 になると詰むので、3 → 2 の順に緩める。
 */
export interface QueueState {
  /** 出題済みの ID */
  seen: readonly string[]
  /** 直近の出題（末尾が最新）。制約判定にのみ使う */
  history: readonly Clip[]
}

const HISTORY_LIMIT = 8

export function createQueue(): QueueState {
  return { seen: [], history: [] }
}

/** 末尾から数えて同じ種類が何本続いているか */
export function trailingKindRun(history: readonly Clip[]): number {
  if (history.length === 0) return 0
  const kind = history[history.length - 1].isAI
  let n = 0
  for (let i = history.length - 1; i >= 0 && history[i].isAI === kind; i--) n++
  return n
}

export interface PickResult {
  clip: Clip
  state: QueueState
}

export function pickNext(pool: readonly Clip[], state: QueueState, rng: Rng): PickResult {
  if (pool.length === 0) throw new Error('出題できる動画がありません')

  const last = state.history[state.history.length - 1]

  // 1. 未出題のものだけ。尽きたらリセットする（直前の1本だけは避ける）
  let seen = state.seen
  let unseen = pool.filter((c) => !seen.includes(c.id))
  if (unseen.length === 0) {
    seen = []
    unseen = pool.filter((c) => c.id !== last?.id)
    if (unseen.length === 0) unseen = [...pool]
  }

  // 2. 同種の連続本数の上限
  const run = trailingKindRun(state.history)
  const mustSwitchKind = last !== undefined && run >= RULES.maxSameKindRun
  const kindOk = mustSwitchKind ? unseen.filter((c) => c.isAI !== last.isAI) : unseen

  // 3. 同じ元作品の連続を避ける
  const workOk = last ? kindOk.filter((c) => c.work !== last.work) : kindOk

  // 候補が尽きたら 3 → 2 の順に緩める
  const candidates = workOk.length > 0 ? workOk : kindOk.length > 0 ? kindOk : unseen

  const clip = candidates[Math.floor(rng() * candidates.length)]
  const history = [...state.history, clip].slice(-HISTORY_LIMIT)
  return { clip, state: { seen: [...seen, clip.id], history } }
}

/**
 * 先読みバッファを size 本まで満たす。
 * 実際に出題する順序をそのまま先に確定させるので、
 * 「先読みした動画」と「次に出る動画」が必ず一致する。
 */
export function fillBuffer(
  pool: readonly Clip[],
  state: QueueState,
  rng: Rng,
  size: number,
  buffer: readonly Clip[] = [],
): { buffer: Clip[]; state: QueueState } {
  const out = [...buffer]
  let s = state
  while (out.length < size) {
    const r = pickNext(pool, s, rng)
    out.push(r.clip)
    s = r.state
  }
  return { buffer: out, state: s }
}
