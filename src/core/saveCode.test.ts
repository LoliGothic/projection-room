import { describe, expect, it } from 'vitest'
import { decodeSaveCode, encodeSaveCode } from './saveCode'
import { EMPTY_RECORDS, recordEnding, type Records } from './records'
import { createStats } from './progress'
import { ENDING_ORDER } from '../config/endings.data'

const filled: Records = {
  version: 1,
  seenEndings: ['closed', 'blackout'],
  plays: 41,
  escapes: 3,
  bestLoops: 12,
}

describe('セーブコード', () => {
  it('書き出して読み込むと元に戻る', () => {
    const r = decodeSaveCode(encodeSaveCode(filled))
    expect(r.ok).toBe(true)
    expect(r.records).toEqual(filled)
  })

  it('何も達成していない記録も往復できる', () => {
    const r = decodeSaveCode(encodeSaveCode(EMPTY_RECORDS))
    expect(r.ok).toBe(true)
    expect(r.records).toEqual(EMPTY_RECORDS)
  })

  it('全エンディング達成も往復できる', () => {
    const all: Records = { ...filled, seenEndings: [...ENDING_ORDER] }
    expect(decodeSaveCode(encodeSaveCode(all)).records.seenEndings).toEqual([...ENDING_ORDER])
  })

  it('短い文字列になる', () => {
    expect(encodeSaveCode(filled).length).toBeLessThanOrEqual(24)
  })

  it('大文字・小文字と前後の空白を気にしない', () => {
    const code = encodeSaveCode(filled)
    expect(decodeSaveCode(`  ${code.toLowerCase()}  `).records).toEqual(filled)
  })

  it('壊れたコードは読み込まない', () => {
    const code = encodeSaveCode(filled)
    const broken = code.slice(0, -3) + 'XXX'
    const r = decodeSaveCode(broken)
    expect(r.ok).toBe(false)
    expect(r.reason).toBeTruthy()
  })

  it('形式が違うものも弾く', () => {
    for (const bad of ['', 'hello', 'PR1-1-2', 'XX1-1-2-3-4-5a']) {
      expect(decodeSaveCode(bad).ok).toBe(false)
    }
  })
})

describe('recordEnding', () => {
  it('初めてのエンディングを足し、遊んだ回数を増やす', () => {
    const r = recordEnding(EMPTY_RECORDS, 'closed', { ...createStats(), loops: 4 }, true)
    expect(r.seenEndings).toEqual(['closed'])
    expect(r.plays).toBe(1)
    expect(r.escapes).toBe(1)
    expect(r.bestLoops).toBe(4)
  })

  it('同じエンディングを重複して足さない', () => {
    let r = recordEnding(EMPTY_RECORDS, 'closed', createStats(), true)
    r = recordEnding(r, 'closed', createStats(), true)
    expect(r.seenEndings).toEqual(['closed'])
    expect(r.plays).toBe(2)
  })

  it('脱出していなければ脱出回数と最少ループは変わらない', () => {
    const base = recordEnding(EMPTY_RECORDS, 'closed', { ...createStats(), loops: 2 }, true)
    const r = recordEnding(base, 'blackout', { ...createStats(), loops: 0 }, false)
    expect(r.escapes).toBe(1)
    expect(r.bestLoops).toBe(2)
    expect(r.seenEndings).toEqual(['closed', 'blackout'])
  })

  it('最少ループは小さいほうを残す', () => {
    let r = recordEnding(EMPTY_RECORDS, 'closed', { ...createStats(), loops: 9 }, true)
    r = recordEnding(r, 'closed', { ...createStats(), loops: 3 }, true)
    r = recordEnding(r, 'closed', { ...createStats(), loops: 7 }, true)
    expect(r.bestLoops).toBe(3)
  })
})
