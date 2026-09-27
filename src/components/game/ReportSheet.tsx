import { useEffect, useState } from 'react'
import { REPORT_ARM_MS, REPORT_REASONS, REPORT_RECEIVED } from '../../config/report.data'

interface Props {
  /** 「AIが生成した動画」を選んだとき */
  onJudge: () => void
  onClose: () => void
}

/**
 * 報告シート。下から出てくる。
 *
 * 「AIが生成した動画」を選んだときだけ判定になる。
 * ほかの理由は受け付けたふりをして閉じるだけで、進行には影響しない。
 *
 * 報告ボタンを押した時点では何も起きないので、これ自体が確認を兼ねている。
 */
export function ReportSheet({ onJudge, onClose }: Props) {
  const [sent, setSent] = useState(false)
  // 出てきた瞬間は受け付けない。連打した指が先頭の項目に当たるのを防ぐ
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setArmed(true), REPORT_ARM_MS)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="sheet-backdrop" onPointerDown={onClose} role="presentation">
      <div
        className="report-sheet"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="報告"
      >
        <div className="sheet-head">
          <span className="sheet-title">{sent ? '報告' : 'この投稿を報告'}</span>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="報告を閉じる">
            ✕
          </button>
        </div>

        {sent ? (
          <p className="report-sent">{REPORT_RECEIVED}</p>
        ) : (
          <ul className="report-list">
            {REPORT_REASONS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={r.judges ? 'report-reason primary' : 'report-reason'}
                  disabled={!armed}
                  onClick={() => (r.judges ? onJudge() : setSent(true))}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
