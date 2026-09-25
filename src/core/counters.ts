/**
 * ハートやコメントの数など、フィードに出る飾りの数字。
 *
 * 動画の ID から決めるので、同じ動画なら毎回同じ値になる。
 * 本物か AI かは一切見ていない。見分けの手がかりにしないため。
 */

function hash(seed: string, salt: string): number {
  let h = 2166136261
  for (const ch of `${seed}:${salt}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export interface Counters {
  likes: number
  comments: number
  shares: number
}

/** 素の値。落ち着いた桁に収める */
export function baseCounters(clipId: string): Counters {
  const likes = Math.round(180 + hash(clipId, 'like') * 42_000)
  // 共有はハートではなくコメントを基準にする。
  // それぞれ独立に振ると、共有のほうが多い不自然な並びになることがある
  const comments = Math.max(1, Math.round(likes * (0.012 + hash(clipId, 'cm') * 0.05)))
  return {
    likes,
    comments,
    shares: Math.max(0, Math.round(comments * (0.08 + hash(clipId, 'sh') * 0.4))),
  }
}

/**
 * 不穏タイマーで勝手に増えたぶんを足す。
 * 長く見ているほど、数字だけが不自然に伸びていく。
 */
export function driftedCounters(
  base: Counters,
  elapsedSec: number,
  drift: number,
  perSec: number,
): Counters {
  const add = Math.floor(elapsedSec * drift * perSec)
  return {
    likes: base.likes + add,
    comments: base.comments + Math.floor(add * 0.22),
    shares: base.shares + Math.floor(add * 0.07),
  }
}

/** 1.2万 のような表記にする */
export function formatCount(n: number): string {
  if (n < 10_000) return n.toLocaleString('ja-JP')
  if (n < 100_000_000) return `${(n / 10_000).toFixed(n < 100_000 ? 1 : 0)}万`
  return `${(n / 100_000_000).toFixed(1)}億`
}
