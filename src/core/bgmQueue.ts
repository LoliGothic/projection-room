import { seededRng } from './rng'

/**
 * BGM の並び。投稿が変わるたびに曲も変える。
 *
 * 毎回その場で選ぶと、短い間に同じ曲が二度流れることがある。
 * 作り物だと気づかれる手がかりになるので、clipQueue と同じく
 * 「一巡するまで同じ曲を出さない」方式にしてある。
 *
 * 状態を持たず、種と送った回数だけから決まる。曲の選択に記録は要らないうえ、
 * 再生と巻き戻しのたびに整合を取る手間が無くなる。
 *
 * 種は遊び始めるたびに引き直す。これが無いと毎回まったく同じ順に流れて、
 * 二度目からは選ばれていないことが分かってしまう。
 */

/** シャッフルしただけの並び。種と周ごとに違う順になる */
function rawOrder(count: number, cycle: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  const rng = seededRng((seed ^ Math.imul(cycle + 1, 2654435761)) >>> 0)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * その周の並び。
 *
 * 周の変わり目で同じ曲が続かないよう、先頭が前の周の最後と同じときだけ
 * 2番目と入れ替える。入れ替えるのは先頭側だけなので、最後の曲は
 * 前後どちらから見ても変わらない。
 */
export function bgmOrder(count: number, cycle: number, seed = 0): number[] {
  const order = rawOrder(count, cycle, seed)
  if (count > 2 && cycle > 0) {
    const prevLast = rawOrder(count, cycle - 1, seed)[count - 1]
    if (order[0] === prevLast) [order[0], order[1]] = [order[1], order[0]]
  }
  return order
}

/** 何回目の投稿でどの曲を流すか。曲が無ければ -1 */
export function bgmIndexAt(count: number, turn: number, seed = 0): number {
  if (count <= 0) return -1
  if (count === 1) return 0
  const t = Math.max(0, Math.floor(turn))
  return bgmOrder(count, Math.floor(t / count), seed)[t % count]
}

/** 遊び始めるたびに引き直す種 */
export function randomBgmSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0
}
