import { create } from 'zustand'
import { KEYS, readJSON, writeJSON } from '../core/storage'

export interface Settings {
  /** 0..1 */
  volume: number
  muted: boolean
  /** 演出の強さ 0..1 */
  fxIntensity: number
  /** 点滅を弱める：揺れ・明滅・切替の一瞬・人影をまとめて無効化 */
  reduceFlashing: boolean
  /** 演出を軽くする：Canvas の重い演出を簡易版に */
  lightFx: boolean
  /** 初回の注意表示を読んだか */
  warningSeen: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  muted: false,
  fxIntensity: 1,
  reduceFlashing: false,
  lightFx: false,
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
    lightFx: s.lightFx,
    warningSeen: s.warningSeen,
  }
}

/** 「点滅を弱める」を踏まえた実効の演出強度 */
export function effectiveFx(s: Settings): number {
  return s.reduceFlashing ? 0 : s.fxIntensity
}
