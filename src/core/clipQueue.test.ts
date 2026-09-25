import { describe, expect, it } from 'vitest'
import type { Clip } from './types'
import {
  createQueue,
  fillBuffer,
  pickNext,
  planCycle,
  trailingCategoryRun,
  trailingKindRun,
} from './clipQueue'
import { seededRng } from './rng'
import { RULES } from '../config/tuning'

function makeClip(id: string, isAI: boolean, category: string): Clip {
  return { id, src: `clips/${id}.mp4`, isAI, category }
}

/**
 * 本物 n 本 / AI n 本。
 * カテゴリは本物と AI で共通にし、2 本ずつ同じにして連続を起こしやすくする
 */
function makePool(perSide: number): Clip[] {
  const out: Clip[] = []
  for (let i = 0; i < perSide; i++) {
    out.push(makeClip(`r${i}`, false, `cat-${Math.floor(i / 2)}`))
    out.push(makeClip(`a${i}`, true, `cat-${Math.floor(i / 2)}`))
  }
  return out
}

/** 実際の出題順を n 本ぶん取り出す */
function draw(pool: Clip[], n: number, seed = 1): Clip[] {
  const rng = seededRng(seed)
  let state = createQueue()
  const out: Clip[] = []
  for (let i = 0; i < n; i++) {
    const r = pickNext(pool, state, rng)
    out.push(r.clip)
    state = r.state
  }
  return out
}

describe('trailingCategoryRun', () => {
  it('末尾から数えて同じカテゴリが続いている本数を返す', () => {
    const x = makeClip('x', false, 'cat-a')
    const y = makeClip('y', true, 'cat-a')
    const z = makeClip('z', false, 'cat-b')
    expect(trailingCategoryRun([])).toBe(0)
    expect(trailingCategoryRun([z, x, y])).toBe(2)
    expect(trailingCategoryRun([x, y, z])).toBe(1)
  })
})

describe('trailingKindRun', () => {
  it('末尾から数えて同じ種類が続いている本数を返す', () => {
    const a = makeClip('a', true, 'cat-a')
    const r = makeClip('r', false, 'cat-r')
    expect(trailingKindRun([])).toBe(0)
    expect(trailingKindRun([r])).toBe(1)
    expect(trailingKindRun([r, a, a, a])).toBe(3)
    expect(trailingKindRun([a, a, r])).toBe(1)
  })
})

describe('pickNext', () => {
  it('在庫を使い切るまで同じ動画を出さない', () => {
    const pool = makePool(12) // 24本
    const drawn = draw(pool, pool.length)
    expect(new Set(drawn.map((c) => c.id)).size).toBe(pool.length)
  })

  it('在庫が尽きたら出題済みをリセットして続けられる', () => {
    const pool = makePool(12)
    const drawn = draw(pool, pool.length * 3)
    expect(drawn).toHaveLength(pool.length * 3)
    // 1周目と2周目でそれぞれ全種類が出ている
    expect(new Set(drawn.slice(0, pool.length).map((c) => c.id)).size).toBe(pool.length)
    expect(new Set(drawn.slice(pool.length, pool.length * 2).map((c) => c.id)).size).toBe(pool.length)
  })

  it('リセットの境目で同じ動画が連続しない', () => {
    const pool = makePool(12)
    for (let seed = 1; seed <= 40; seed++) {
      const drawn = draw(pool, pool.length * 2 + 4, seed)
      for (let i = 1; i < drawn.length; i++) {
        expect(drawn[i].id).not.toBe(drawn[i - 1].id)
      }
    }
  })

  it('同じ種類が5本以上連続しない', () => {
    const pool = makePool(12)
    for (let seed = 1; seed <= 40; seed++) {
      const drawn = draw(pool, 200, seed)
      let run = 1
      for (let i = 1; i < drawn.length; i++) {
        run = drawn[i].isAI === drawn[i - 1].isAI ? run + 1 : 1
        expect(run).toBeLessThanOrEqual(RULES.maxSameKindRun)
      }
    }
  })

  it('同じカテゴリが3本以上連続しない', () => {
    const pool = makePool(12)
    for (let seed = 1; seed <= 40; seed++) {
      const drawn = draw(pool, 200, seed)
      let run = 1
      for (let i = 1; i < drawn.length; i++) {
        run = drawn[i].category === drawn[i - 1].category ? run + 1 : 1
        expect(run).toBeLessThanOrEqual(RULES.maxSameCategoryRun)
      }
    }
  })

  it('本物と AI の両方が出る', () => {
    const drawn = draw(makePool(12), 60)
    expect(drawn.some((c) => c.isAI)).toBe(true)
    expect(drawn.some((c) => !c.isAI)).toBe(true)
  })

  it('候補が極端に少なくても詰まらず、制約は緩い順に外れる', () => {
    // 同じカテゴリの本物 2 本だけ。制約は満たせないが出題は続けられる
    const pool = [makeClip('r0', false, 'c'), makeClip('r1', false, 'c')]
    const drawn = draw(pool, 10)
    expect(drawn).toHaveLength(10)
    for (let i = 1; i < drawn.length; i++) {
      expect(drawn[i].id).not.toBe(drawn[i - 1].id)
    }
  })

  it('動画が 1 本もなければ例外を投げる', () => {
    expect(() => pickNext([], createQueue(), seededRng(1))).toThrow()
  })
})

describe('planCycle', () => {
  it('在庫を過不足なく 1 回ずつ並べる', () => {
    const pool = makePool(12)
    const plan = planCycle(pool, seededRng(5), [])
    expect(plan).toHaveLength(pool.length)
    expect(new Set(plan.map((c) => c.id)).size).toBe(pool.length)
  })

  it('直前のサイクルの末尾を引き継いで制約を守る', () => {
    const pool = makePool(12)
    // 直前が AI 4 連続なら、次のサイクルの先頭は本物になる
    const tail = pool.filter((c) => c.isAI).slice(0, RULES.maxSameKindRun)
    const plan = planCycle(pool, seededRng(11), tail)
    expect(plan[0].isAI).toBe(false)
  })

  it('直前のサイクル末尾のカテゴリ連続も引き継ぐ', () => {
    const pool = makePool(12)
    const sameCat = pool.filter((c) => c.category === 'cat-0').slice(0, RULES.maxSameCategoryRun)
    const plan = planCycle(pool, seededRng(23), sameCat)
    expect(plan[0].category).not.toBe('cat-0')
  })
})

describe('fillBuffer', () => {
  it('指定した本数まで満たし、残りの並びが減る', () => {
    const pool = makePool(12)
    const r = fillBuffer(pool, createQueue(), seededRng(3), 3)
    expect(r.buffer).toHaveLength(3)
    expect(r.state.plan).toHaveLength(pool.length - 3)
  })

  it('先読みした順序が、実際の出題順と一致する', () => {
    const pool = makePool(12)
    // バッファを 3 本ぶん作り、先頭を消費してから 1 本足す流れを再現する
    const rng = seededRng(9)
    const first = fillBuffer(pool, createQueue(), rng, 3)
    const after = fillBuffer(pool, first.state, rng, 3, first.buffer.slice(1))
    // 2 本目・3 本目は先読み時のものがそのまま残っている
    expect(after.buffer[0].id).toBe(first.buffer[1].id)
    expect(after.buffer[1].id).toBe(first.buffer[2].id)
    expect(after.buffer).toHaveLength(3)
  })
})
