/**
 * BGM の設定。差し替えるときはここだけ触ればよい。
 *
 * 音源は raw/bgm/ に置いて `npm run prep:bgm` を走らせる。
 * public/audio/bgm/ に切り出され、一覧 public/audio/bgm.json ができる。
 * 一覧が読めなければ Web Audio で合成した仮のBGMに落ちる。
 */
export const BGM = {
  /** 曲の一覧。public/ からの相対パス */
  manifest: 'audio/bgm.json',
  /** クレジット画面に出す一行。表記が要らない配布元でも、出どころは残す */
  credit: 'OpenTracks',
  url: 'https://opentracks.com/',
  /** 全体の音量に対する倍率 */
  gain: 0.5,
  /** 曲を切り替えるときに音量を下げ切る時間（秒） */
  switchSec: 0.35,
} as const

/** 一覧ファイルの形 */
export interface BgmTrack {
  id: string
  /** public/ からの相対パス */
  src: string
}

export interface BgmManifest {
  version: number
  tracks: BgmTrack[]
}
