/**
 * 報告シートに並べる理由。
 *
 * 「AIが生成した動画」を選んだときだけ判定になる。
 * ほかは受け付けたふりをして閉じるだけで、進行には影響しない。
 *
 * 選択肢にこの一文があること自体が、遊び方の説明を兼ねている。
 */
export interface ReportReason {
  id: string
  label: string
  /** これを選ぶと「AIだ」と答えたことになる */
  judges: boolean
}

export const REPORT_REASONS: readonly ReportReason[] = [
  { id: 'ai', label: 'AIが生成した動画', judges: true },
  { id: 'inappropriate', label: '不適切な内容', judges: false },
  { id: 'spam', label: 'スパム・誤解を招く内容', judges: false },
  { id: 'rights', label: '権利の侵害', judges: false },
  { id: 'other', label: 'その他', judges: false },
]

/** 判定にならない理由を選んだときに出す文 */
export const REPORT_RECEIVED = '報告を受け付けました。確認までお待ちください。'

/**
 * シートが出てから、項目を受け付けるまでの間（ms）。
 * ボタンを連打すると、出てきた瞬間の先頭の項目に指が当たってしまうため。
 */
export const REPORT_ARM_MS = 240
