/** clips.json の 1 本分。src は 'clips/xxx.mp4' の相対形式で保持する。 */
export interface Clip {
  id: string
  src: string
  /** true = AI生成（焼き捨てるべき） */
  isAI: boolean
  /** 元作品グループ。同じ作品の場面が連続しないようにするための識別子 */
  work: string
  title?: string
  year?: number
  director?: string
  sourceUrl?: string
  license?: string
  /** 生成ツール名（AIの場合） */
  tool?: string
  /** 振り返り画面に出す解説 */
  note?: string
}

export interface ClipsFile {
  version: number
  clips: Clip[]
}

/** プレイヤーの回答。右スワイプ＝映写する、左スワイプ＝焼き捨てる */
export type Verdict = 'project' | 'burn'

/** その回答が正しかったか */
export function isCorrect(clip: Clip, verdict: Verdict): boolean {
  return clip.isAI ? verdict === 'burn' : verdict === 'project'
}
