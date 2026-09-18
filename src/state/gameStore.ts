import { create } from 'zustand'
import type { Clip } from '../core/types'
import { defaultRng } from '../core/rng'
import {
  createSession,
  currentClip,
  preloadClips,
  reduce,
  type Phase,
  type Session,
  type SessionEvent,
} from '../core/session'
import { loadClips } from '../data/loadClips'

interface GameStore {
  session: Session | null
  error: string | null
  load: () => Promise<void>
  send: (e: SessionEvent) => void
  goto: (phase: Phase) => void
}

/** ストアは core/session を包むだけ。ルールは一切ここに書かない。 */
export const useGame = create<GameStore>((set, get) => ({
  session: null,
  error: null,

  load: async () => {
    try {
      const clips = await loadClips()
      set({ session: createSession(clips), error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  send: (e) => {
    const s = get().session
    if (!s) return
    set({ session: reduce(s, e, defaultRng) })
  },

  goto: (phase) => get().send({ type: 'goto', phase }),
}))

/* ---- セレクタ ---- */
export const selectPhase = (s: GameStore): Phase | undefined => s.session?.phase
export const selectClip = (s: GameStore): Clip | undefined =>
  s.session ? currentClip(s.session) : undefined
export const selectPreload = (s: GameStore): readonly Clip[] =>
  s.session ? preloadClips(s.session) : []
