import { formatCount, type Counters } from '../../core/counters'

interface Props {
  counters: Counters
  onReplay: () => void
  /** 飾りのボタンを押したときの反応（音だけ鳴らす） */
  onDecorative: () => void
}

/**
 * 右側の縦並びアイコン。
 * リプレイだけが実際に動き、ハート・コメント・共有は飾り。
 * 数字は動画の ID から決まるので、本物か AI かの手がかりにはならない。
 */
export function SideActions({ counters, onReplay, onDecorative }: Props) {
  return (
    <div className="side-actions">
      <button type="button" className="side-item" onClick={onReplay} aria-label="最初から再生">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5" />
        </svg>
        <span className="side-label">最初から</span>
      </button>

      <button
        type="button"
        className="side-item"
        onClick={onDecorative}
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
        onClick={onDecorative}
        aria-label={`共有 ${counters.shares}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4" />
        </svg>
        <span className="side-label">{formatCount(counters.shares)}</span>
      </button>
    </div>
  )
}
