import { create } from 'zustand'
import { KEYS, readJSON, writeJSON } from '../core/storage'

export interface Settings {
  /** 0..1 */
  volume: number
  muted: boolean
  /** 演出の強さ 0..1 */
  fxIntensity: number
  /** 演出を弱める：揺れ・明滅・通知の連続表示をまとめて弱める */
  reduceFlashing: boolean
  /** 初回の注意表示を読んだか */
  warningSeen: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  muted: false,
  fxIntensity: 1,
  reduceFlashing: false,
  warningSeen: false,
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...readJSON<Settings>(KEYS.settings, DEFAULT_SETTINGS),
  set: (patch) => {
    set(patch)
    writeJSON(KEYS.settings, pickSettings(get()))
  },
}))

/** ストアから保存対象のフィールドだけ取り出す */
function pickSettings(s: Settings): Settings {
  return {
    volume: s.volume,
    muted: s.muted,
    fxIntensity: s.fxIntensity,
    reduceFlashing: s.reduceFlashing,
    warningSeen: s.warningSeen,
  }
}

/**
 * 「演出を弱める」を踏まえた実効の演出強度。
 * 0 にはしない。不穏タイマーは遊びの根幹なので、弱めても残す。
 */
export function effectiveFx(s: Settings): number {
  return s.reduceFlashing ? s.fxIntensity * 0.4 : s.fxIntensity
}
