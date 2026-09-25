/** clips.json の 1 本分。src は 'clips/xxx.mp4' の相対形式で保持する。 */
export interface Clip {
  id: string
  src: string
  /** true = AI生成（報告すべき） */
  isAI: boolean
  /** カテゴリ。同じカテゴリが3本以上続かないようにするために使う */
  category: string
  /** 何が写っているか（滝・猫など） */
  scene?: string
  /** 入手元サービス名（Pexels など） */
  source?: string
  sourceUrl?: string
  /** 投稿者名として表示する。本物は提供者名、AIは架空のアカウント名 */
  contributor?: string
  /** 生成ツール名（AIの場合） */
  tool?: string
  /** 振り返り画面に出す解説 */
  note?: string
}

export interface ClipsFile {
  version: number
  clips: Clip[]
}

/** プレイヤーの回答。右スワイプ＝残す、左スワイプ＝報告する */
export type Verdict = 'keep' | 'report'

/** その回答が正しかったか */
export function isCorrect(clip: Clip, verdict: Verdict): boolean {
  return clip.isAI ? verdict === 'report' : verdict === 'keep'
}
