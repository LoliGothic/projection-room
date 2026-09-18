import { KEYS, readJSON, writeJSON } from './storage'
import type { Stats } from './progress'

/** localStorage に残す記録 */
export interface Records {
  version: number
  /** 見たエンディングの ID */
  seenEndings: string[]
  /** 遊んだ回数（エンディングに到達した回数） */
  plays: number
  /** 脱出した回数 */
  escapes: number
  /** 脱出したときの最少ループ回数。未脱出なら null */
  bestLoops: number | null
}

export const EMPTY_RECORDS: Records = {
  version: 1,
  seenEndings: [],
  plays: 0,
  escapes: 0,
  bestLoops: null,
}

export function loadRecords(): Records {
  const r = readJSON<Records>(KEYS.records, EMPTY_RECORDS)
  // 壊れた値が入っていても遊べるように整える
  return {
    version: 1,
    seenEndings: Array.isArray(r.seenEndings) ? r.seenEndings.filter((x) => typeof x === 'string') : [],
    plays: Number.isFinite(r.plays) ? Math.max(0, Math.trunc(r.plays)) : 0,
    escapes: Number.isFinite(r.escapes) ? Math.max(0, Math.trunc(r.escapes)) : 0,
    bestLoops:
      typeof r.bestLoops === 'number' && Number.isFinite(r.bestLoops)
        ? Math.max(0, Math.trunc(r.bestLoops))
        : null,
  }
}

export function saveRecords(r: Records): boolean {
  return writeJSON(KEYS.records, r)
}

/** エンディングに到達したときの記録更新（純粋関数） */
export function recordEnding(
  records: Records,
  endingId: string,
  stats: Stats,
  escaped: boolean,
): Records {
  const seenEndings = records.seenEndings.includes(endingId)
    ? records.seenEndings
    : [...records.seenEndings, endingId]

  const bestLoops = escaped
    ? records.bestLoops === null
      ? stats.loops
      : Math.min(records.bestLoops, stats.loops)
    : records.bestLoops

  return {
    version: 1,
    seenEndings,
    plays: records.plays + 1,
    escapes: records.escapes + (escaped ? 1 : 0),
    bestLoops,
  }
}
