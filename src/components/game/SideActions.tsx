import { useState } from 'react'
import { formatCount, type Counters } from '../../core/counters'

interface Props {
  counters: Counters
  /** 報告シートを開く。判定になるのはシートで「AIが生成した動画」を選んだとき */
  onReport: () => void
  /** コメント欄を開く */
  onComments: () => void
  /** 共有（外部サイトを開く） */
  onShare: () => void
  /** 飾りのボタンを押したときの反応（音だけ鳴らす） */
  onDecorative: () => void
  enabled: boolean
}

/**
 * 投稿ごとの右側の縦並びアイコン。
 *
 * 判定になるのは報告だけ。押すと理由を選ぶシートが出るので、
 * ここを押した時点ではまだ何も起きない。
 * 本物だと思ったら、そのまま上にスクロールして送る。
 *
 * ハート・コメント・共有は飾り。数字は動画の ID から決まるので、
 * 本物か AI かの手がかりにはならない。
 */
export function SideActions({
  counters,
  onReport,
  onComments,
  onShare,
  onDecorative,
  enabled,
}: Props) {
  const [liked, setLiked] = useState(false)

  return (
    <div className="side-actions">
      <button
        type="button"
        className={liked ? 'side-item like on' : 'side-item like'}
        onClick={() => {
          setLiked((v) => !v)
          onDecorative()
        }}
        disabled={!enabled}
        aria-label={`いいね ${counters.likes}`}
        aria-pressed={liked}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7-2.6c0 4.8-7 14.6-7 14.6Z" />
        </svg>
        <span className="side-label">{formatCount(counters.likes + (liked ? 1 : 0))}</span>
      </button>

      <button
        type="button"
        className="side-item"
        onClick={onComments}
        disabled={!enabled}
        aria-label={`コメント ${counters.comments}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4V5Z" />
        </svg>
        <span className="side-label">{formatCount(counters.comments)}</span>
      </button>

      <button
        type="button"
        className="side-item"
        onClick={onShare}
        disabled={!enabled}
        aria-label="共有"
      >
        {/* 右へ向かう矢印。箱＋上矢印だとダウンロードに見えてしまう */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 4.5 21 11l-8 6.5V14c-4.7 0-8 1.6-10.5 4.6C3.3 12 6.7 8.3 13 7.8V4.5Z" />
        </svg>
        <span className="side-label">共有</span>
      </button>

      <button
        type="button"
        className="side-item report"
        onClick={onReport}
        disabled={!enabled}
        aria-label="報告"
      >
        {/* 旗。押すと理由を選ぶシートが出る */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 21V4M5 5h12l-2.5 4L17 13H5" />
        </svg>
        <span className="side-label">報告</span>
      </button>
    </div>
  )
}
