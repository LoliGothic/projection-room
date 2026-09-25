import type { Clip, Verdict } from './types'
import type { Rng } from './rng'
import { createQueue, fillBuffer, type QueueState } from './clipQueue'
import { applyAnswer, applyDarkness, applyReplay, createProgress, type Progress } from './progress'
import { resolveEnding } from './endings'
import { RULES } from '../config/tuning'

/**
 * ゲーム全体の流れを持つステートマシン。React には依存しない。
 * 演出の「時間待ち」だけは UI 側がタイマーで面倒を見て、終わったら cutsceneDone を送る。
 */
export type Phase =
  /** 起動画面 */
  | { name: 'launch' }
  | { name: 'playing' }
  /** ミス：画面が固まる → 読み込み中 → おすすめリセットの通知 */
  | { name: 'resetting' }
  | { name: 'ending'; endingId: string }
  | { name: 'recap' }
  | { name: 'gallery' }
  | { name: 'settings' }
  | { name: 'credits' }

export interface Deck {
  queue: QueueState
  /** 先頭が現在の 1 本。以降は先読み用 */
  buffer: readonly Clip[]
  /**
   * ひとつ前に出ていた 1 本。
   * 下から次が上がってくる動きを見せるあいだ、上へ抜けていく側として残す。
   */
  previous?: Clip
  /**
   * 先頭を何回進めたか。<video> のスロット割り当てに使う。
   * 回答した本数とは一致しない（ミス演出のあいだは進めないため）
   */
  advances: number
}

export interface Session {
  pool: readonly Clip[]
  phase: Phase
  progress: Progress
  deck: Deck
}

export type SessionEvent =
  /** 起動画面からフィードを開く */
  | { type: 'start' }
  | { type: 'answer'; verdict: Verdict }
  | { type: 'replay' }
  /** リセット演出の再生が終わった */
  | { type: 'cutsceneDone' }
  /** 不穏タイマーを使い切った */
  | { type: 'darkness' }
  /** 画面遷移だけ（設定・クレジットなど） */
  | { type: 'goto'; phase: Phase }

const BUFFER_SIZE = RULES.preloadAhead + 1

function refill(pool: readonly Clip[], deck: Deck, rng: Rng): Deck {
  const r = fillBuffer(pool, deck.queue, rng, BUFFER_SIZE, deck.buffer)
  return { ...deck, queue: r.state, buffer: r.buffer }
}

/** 先頭を 1 本進めて、先読みを補充する */
function advance(pool: readonly Clip[], deck: Deck, rng: Rng): Deck {
  return refill(
    pool,
    {
      ...deck,
      previous: deck.buffer[0],
      buffer: deck.buffer.slice(1),
      advances: deck.advances + 1,
    },
    rng,
  )
}

export function createSession(pool: readonly Clip[]): Session {
  return {
    pool,
    phase: { name: 'launch' },
    progress: createProgress(),
    deck: { queue: createQueue(), buffer: [], advances: 0 },
  }
}

/** いま出題中の 1 本 */
export function currentClip(s: Session): Clip | undefined {
  return s.deck.buffer[0]
}

/** 先読み中の動画（表示はしない） */
export function preloadClips(s: Session): readonly Clip[] {
  return s.deck.buffer.slice(1)
}

/** 上へ抜けていく 1 本。最初の 1 本のときは無い */
export function previousClip(s: Session): Clip | undefined {
  return s.deck.previous
}

export function reduce(s: Session, e: SessionEvent, rng: Rng): Session {
  switch (e.type) {
    case 'start': {
      const deck = refill(s.pool, { queue: createQueue(), buffer: [], advances: 0 }, rng)
      return { ...s, progress: createProgress(), deck, phase: { name: 'playing' } }
    }

    case 'cutsceneDone': {
      if (s.phase.name === 'resetting') {
        // ここで初めて次の 1 本へ進める。
        // 回答した時点で進めてしまうと、リセット演出の裏で次の問題が見えてしまう
        return { ...s, deck: advance(s.pool, s.deck, rng), phase: { name: 'playing' } }
      }
      return s
    }

    case 'replay': {
      if (s.phase.name !== 'playing') return s
      return { ...s, progress: applyReplay(s.progress) }
    }

    case 'darkness': {
      if (s.phase.name !== 'playing') return s
      const progress = applyDarkness(s.progress)
      return {
        ...s,
        progress,
        phase: {
          name: 'ending',
          endingId: resolveEnding(progress.stats, 'darkness')?.id ?? 'blackout',
        },
      }
    }

    case 'answer': {
      if (s.phase.name !== 'playing') return s
      const clip = currentClip(s)
      if (!clip) return s

      const { progress, outcome } = applyAnswer(s.progress, clip, e.verdict)

      // ミスのときは進めない。リセット演出は、いま間違えた動画の上で起きる
      if (outcome.kind === 'loop') {
        return { ...s, progress, phase: { name: 'resetting' } }
      }

      // 回答したら間を置かず次へ。出題済みはループしてもリセットしない
      const deck = advance(s.pool, s.deck, rng)

      if (outcome.kind === 'escaped') {
        return {
          ...s,
          progress,
          deck,
          phase: {
            name: 'ending',
            endingId: resolveEnding(progress.stats, 'escape')?.id ?? 'closed',
          },
        }
      }
      return { ...s, progress, deck, phase: { name: 'playing' } }
    }

    case 'goto':
      return { ...s, phase: e.phase }
  }
}
