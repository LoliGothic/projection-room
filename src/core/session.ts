import type { Clip, Verdict } from './types'
import type { Rng } from './rng'
import { createQueue, fillBuffer, type QueueState } from './clipQueue'
import { applyAnswer, applyDarkness, applyReplay, createProgress, type Progress } from './progress'
import { RULES } from '../config/tuning'
import { intertitleFor, type Intertitle } from '../config/intertitles.data'

/**
 * ゲーム全体の流れを持つステートマシン。React には依存しない。
 * 演出の「時間待ち」だけは UI 側がタイマーで面倒を見て、終わったら cutsceneDone を送る。
 */
export type Phase =
  | { name: 'title' }
  /** 巻の節目の暗転＋字幕カード */
  | { name: 'intertitle'; card: Intertitle; reel: number }
  | { name: 'playing' }
  /** ミス：映写機停止 → 暗転 → 巻き戻し */
  | { name: 'loopCut' }
  | { name: 'ending'; endingId: string }
  | { name: 'recap' }
  | { name: 'gallery' }
  | { name: 'settings' }
  | { name: 'credits' }

export interface Deck {
  queue: QueueState
  /** 先頭が現在の 1 本。以降は先読み用 */
  buffer: readonly Clip[]
}

export interface Session {
  pool: readonly Clip[]
  phase: Phase
  progress: Progress
  deck: Deck
}

export type SessionEvent =
  /** タイトルから上映を始める */
  | { type: 'start' }
  | { type: 'answer'; verdict: Verdict }
  | { type: 'replay' }
  /** 字幕カード / ループ演出の再生が終わった */
  | { type: 'cutsceneDone' }
  /** 不穏タイマーを使い切った */
  | { type: 'darkness' }
  /** 画面遷移だけ（設定・クレジットなど） */
  | { type: 'goto'; phase: Phase }

const BUFFER_SIZE = RULES.preloadAhead + 1

function refill(pool: readonly Clip[], deck: Deck, rng: Rng): Deck {
  const r = fillBuffer(pool, deck.queue, rng, BUFFER_SIZE, deck.buffer)
  return { queue: r.state, buffer: r.buffer }
}

export function createSession(pool: readonly Clip[]): Session {
  return {
    pool,
    phase: { name: 'title' },
    progress: createProgress(),
    deck: { queue: createQueue(), buffer: [] },
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

export function reduce(s: Session, e: SessionEvent, rng: Rng): Session {
  switch (e.type) {
    case 'start': {
      const progress = createProgress()
      const deck = refill(s.pool, { queue: createQueue(), buffer: [] }, rng)
      return {
        ...s,
        progress,
        deck,
        phase: { name: 'intertitle', card: intertitleFor(1, 0), reel: 1 },
      }
    }

    case 'cutsceneDone': {
      if (s.phase.name === 'intertitle') return { ...s, phase: { name: 'playing' } }
      if (s.phase.name === 'loopCut') {
        // 巻き戻しが終わったら第1巻の字幕カードへ。説明文は出さない
        return {
          ...s,
          phase: { name: 'intertitle', card: intertitleFor(1, s.progress.stats.loops), reel: 1 },
        }
      }
      return s
    }

    case 'replay': {
      if (s.phase.name !== 'playing') return s
      return { ...s, progress: applyReplay(s.progress) }
    }

    case 'darkness': {
      if (s.phase.name !== 'playing') return s
      return {
        ...s,
        progress: applyDarkness(s.progress),
        phase: { name: 'ending', endingId: 'darkness' },
      }
    }

    case 'answer': {
      if (s.phase.name !== 'playing') return s
      const clip = currentClip(s)
      if (!clip) return s

      const { progress, outcome } = applyAnswer(s.progress, clip, e.verdict)
      // 回答したら間を置かず次へ。出題済みはループしてもリセットしない
      const deck = refill(s.pool, { ...s.deck, buffer: s.deck.buffer.slice(1) }, rng)

      switch (outcome.kind) {
        case 'next':
          return { ...s, progress, deck, phase: { name: 'playing' } }
        case 'reelCleared':
          return {
            ...s,
            progress,
            deck,
            phase: {
              name: 'intertitle',
              card: intertitleFor(outcome.reel, progress.stats.loops),
              reel: outcome.reel,
            },
          }
        case 'escaped':
          return { ...s, progress, deck, phase: { name: 'ending', endingId: 'dawn' } }
        case 'loop':
          return { ...s, progress, deck, phase: { name: 'loopCut' } }
      }
      return s
    }

    case 'goto':
      return { ...s, phase: e.phase }
  }
}
