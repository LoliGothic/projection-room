/**
 * BGM の設定。差し替えるときはここだけ触ればよい。
 *
 * public/audio/ に音源を置いて file にパスを書くと、それが流れる。
 * 空のままなら Web Audio で合成した仮のBGMが鳴る。
 *
 * 音源を使う場合は、クレジット画面に出るので title / author / url / license を
 * 必ず埋めること。フリー素材でも表記が必要なものが多い。
 */
export const BGM = {
  /** public/ からの相対パス。例: 'audio/bgm.mp3' */
  file: '',
  title: '',
  author: '',
  url: '',
  license: '',
  /** 全体の音量に対する倍率 */
  gain: 0.5,
} as const

/** 音源ファイルが指定されているか */
export function hasBgmFile(): boolean {
  return BGM.file.trim().length > 0
}
