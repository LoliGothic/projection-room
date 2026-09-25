import { useState } from 'react'
import { formatCount, type Counters } from '../../core/counters'

interface Props {
  counters: Counters
  /** ハート＝この動画は本物だ、という判定 */
  onLike: () => void
  /** メニューから報告＝この動画はAI生成だ、という判定 */
  onReport: () => void
  onReplay: () => void
  /** 飾りのボタンを押したときの反応（音だけ鳴らす） */
  onDecorative: () => void
  enabled: boolean
}

/**
 * 右側の縦並びアイコン。
 *
 * ハートと「…」からの報告が、そのまま判定になる。
 * 報告はひと手間かかる位置に置く。実際のアプリでも、いいねは一押し、
 * 報告はメニューの奥にある。
 *
 * 数字は動画の ID から決まるので、本物か AI かの手がかりにはならない。
 */
export function SideActions({
  counters,
  onLike,
  onReport,
  onReplay,
  onDecorative,
  enabled,
}: Props) {
  const [open, setOpen] = useState(false)
  // 操作できないあいだは開いていないものとして扱う（別の動画に移ったら閉じる）
  const menuOpen = open && enabled

  return (
    <div className="side-actions">
      <button
        type="button"
        className="side-item like"
        onClick={onLike}
        disabled={!enabled}
        aria-label={`いいね ${counters.likes}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7-2.6c0 4.8-7 14.6-7 14.6Z" />
        </svg>
        <span className="side-label">{formatCount(counters.likes)}</span>
      </button>

      <button
        type="button"
        className="side-item"
        onClick={onDecorative}
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
        onClick={onReplay}
        disabled={!enabled}
        aria-label="最初から再生"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5" />
        </svg>
        <span className="side-label">最初から</span>
      </button>

      <div className="side-menu-wrap">
        <button
          type="button"
          className="side-item"
          onClick={() => setOpen((v) => !v)}
          disabled={!enabled}
          aria-label="その他"
          aria-expanded={menuOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.4" />
            <circle cx="12" cy="12" r="1.4" />
            <circle cx="12" cy="19" r="1.4" />
          </svg>
          <span className="side-label">その他</span>
        </button>

        {menuOpen && (
          <div className="side-menu" role="menu">
            <button type="button" role="menuitem" onClick={onDecorative}>
              共有する
            </button>
            <button type="button" role="menuitem" onClick={onDecorative}>
              保存する
            </button>
            <button type="button" role="menuitem" onClick={onDecorative}>
              興味がない
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                setOpen(false)
                onReport()
              }}
            >
              報告する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
