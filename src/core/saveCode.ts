import { ENDING_ORDER } from '../config/endings.data'
import { EMPTY_RECORDS, type Records } from './records'

/**
 * 記録を短い文字列で書き出し / 読み込みする。
 *
 *   PR1-<見たエンディングのビット列>-<遊んだ回数>-<脱出回数>-<最少ループ>-<検査値>
 *
 * いずれも 36 進数。最少ループが無いときは "z"。
 * 数字はすべて 36 進なので、20 回ていどのプレイなら 20 文字前後に収まる。
 */
const PREFIX = 'PR1'
const NONE = 'z'

function toBase36(n: number): string {
  return Math.max(0, Math.trunc(n)).toString(36)
}

function fromBase36(s: string): number {
  const n = parseInt(s, 36)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function checksum(parts: string[]): string {
  let sum = 0
  const joined = parts.join('-')
  for (let i = 0; i < joined.length; i++) sum = (sum * 31 + joined.charCodeAt(i)) % 1296
  return sum.toString(36).padStart(2, '0')
}

export function encodeSaveCode(r: Records): string {
  let mask = 0
  ENDING_ORDER.forEach((id, i) => {
    if (r.seenEndings.includes(id)) mask |= 1 << i
  })

  const parts = [
    PREFIX,
    toBase36(mask),
    toBase36(r.plays),
    toBase36(r.escapes),
    r.bestLoops === null ? NONE : toBase36(r.bestLoops),
  ]
  return [...parts, checksum(parts)].join('-').toUpperCase()
}

export interface DecodeResult {
  ok: boolean
  records: Records
  /** 読めなかった理由 */
  reason?: string
}

export function decodeSaveCode(code: string): DecodeResult {
  const trimmed = code.trim().toLowerCase()
  const parts = trimmed.split('-')

  if (parts.length !== 6 || parts[0] !== PREFIX.toLowerCase()) {
    return { ok: false, records: EMPTY_RECORDS, reason: 'コードの形式が違います' }
  }

  const body = [PREFIX, ...parts.slice(1, 5)]
  if (checksum(body) !== parts[5]) {
    return { ok: false, records: EMPTY_RECORDS, reason: 'コードが壊れています' }
  }

  const mask = fromBase36(parts[1])
  const seenEndings = ENDING_ORDER.filter((_, i) => (mask & (1 << i)) !== 0)

  return {
    ok: true,
    records: {
      version: 1,
      seenEndings,
      plays: fromBase36(parts[2]),
      escapes: fromBase36(parts[3]),
      bestLoops: parts[4] === NONE ? null : fromBase36(parts[4]),
    },
  }
}
