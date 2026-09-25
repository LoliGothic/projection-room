import type { Clip } from './types'
import type { Rng } from './rng'
import { RULES } from '../config/tuning'

/**
 * 出題の選択。UI から完全に独立した純粋関数。
 *
 * 制約:
 *  1. 1回のプレイ中は同じ動画を繰り返さない（在庫が尽きたら出題済みをリセット）
 *  2. 同じ種類（本物/AI）が 5 本以上連続しない
 *  3. 同じカテゴリが 3 本以上連続しない
 *
 * 1 本ずつその場で選ぶと在庫の終盤で 2 と 3 を守れなくなるため、
 * 「在庫 1 周ぶんの並び」をまとめて組み立ててから順に出す。
 * こうすると 3 つの制約が同時に、サイクルの境目をまたいでも成り立つ。
 */
export interface QueueState {
  /** 現在のサイクルで、これから出す順に並んだ動画ID */
  plan: readonly string[]
  /** 直近の出題（末尾が最新）。連続の判定に使う */
  history: readonly Clip[]
}

const HISTORY_LIMIT = 8
/** 並びを作り直す試行回数 */
const PLAN_ATTEMPTS = 40

export function createQueue(): QueueState {
  return { plan: [], history: [] }
}

/** 末尾から数えて同じ種類が何本続いているか */
export function trailingKindRun(history: readonly Clip[]): number {
  if (history.length === 0) return 0
  const kind = history[history.length - 1].isAI
  let n = 0
  for (let i = history.length - 1; i >= 0 && history[i].isAI === kind; i--) n++
  return n
}

/** 末尾から数えて同じカテゴリが何本続いているか */
export function trailingCategoryRun(history: readonly Clip[]): number {
  if (history.length === 0) return 0
  const category = history[history.length - 1].category
  let n = 0
  for (let i = history.length - 1; i >= 0 && history[i].category === category; i--) n++
  return n
}

/** tail の直後に clip を置いてよいか */
function allowed(tail: readonly Clip[], clip: Clip): boolean {
  const last = tail[tail.length - 1]
  if (!last) return true
  // サイクルの境目で同じ動画が続かないようにする。
  // 以前は「同じ作品は連続しない」がこれを兼ねていたが、
  // カテゴリは 2 本まで続けてよいので、明示的に弾く必要がある
  if (clip.id === last.id) return false
  if (
    clip.category === last.category &&
    trailingCategoryRun(tail) >= RULES.maxSameCategoryRun
  ) {
    return false
  }
  if (clip.isAI === last.isAI && trailingKindRun(tail) >= RULES.maxSameKindRun) return false
  return true
}

/**
 * 在庫 1 周ぶんの並びを作る。
 * ランダムに選びながら制約を満たす並びを探し、行き詰まったら作り直す。
 * 極端に偏った在庫（同じカテゴリしかない等）では、満たせない制約を落とした並びを返す。
 */
export function planCycle(pool: readonly Clip[], rng: Rng, prevTail: readonly Clip[]): Clip[] {
  for (let attempt = 0; attempt < PLAN_ATTEMPTS; attempt++) {
    const remaining = [...pool]
    const tail = [...prevTail]
    const out: Clip[] = []
    let stuck = false

    while (remaining.length > 0) {
      const candidates = remaining.filter((c) => allowed(tail, c))
      if (candidates.length === 0) {
        stuck = true
        break
      }
      const chosen = candidates[Math.floor(rng() * candidates.length)]
      remaining.splice(remaining.indexOf(chosen), 1)
      out.push(chosen)
      tail.push(chosen)
    }

    if (!stuck) return out
  }

  // 制約を満たす並びが存在しない在庫。守れるものだけ守って並べる
  const remaining = [...pool]
  const tail = [...prevTail]
  const out: Clip[] = []
  while (remaining.length > 0) {
    const strict = remaining.filter((c) => allowed(tail, c))
    const loose =
      strict.length > 0 ? strict : remaining.filter((c) => c.id !== tail[tail.length - 1]?.id)
    const candidates = loose.length > 0 ? loose : remaining
    const chosen = candidates[Math.floor(rng() * candidates.length)]
    remaining.splice(remaining.indexOf(chosen), 1)
    out.push(chosen)
    tail.push(chosen)
  }
  return out
}

export interface PickResult {
  clip: Clip
  state: QueueState
}

export function pickNext(pool: readonly Clip[], state: QueueState, rng: Rng): PickResult {
  if (pool.length === 0) throw new Error('出題できる動画がありません')

  let plan = state.plan
  if (plan.length === 0) {
    // 在庫が尽きた。次の 1 周ぶんを組み直す
    plan = planCycle(pool, rng, state.history).map((c) => c.id)
  }

  const id = plan[0]
  const clip = pool.find((c) => c.id === id) ?? pool[Math.floor(rng() * pool.length)]
  const history = [...state.history, clip].slice(-HISTORY_LIMIT)
  return { clip, state: { plan: plan.slice(1), history } }
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
