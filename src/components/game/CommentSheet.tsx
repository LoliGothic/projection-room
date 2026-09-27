import { commentsFor } from '../../config/feed.data'
import { formatCount } from '../../core/counters'

interface Props {
  clipId: string
  loops: number
  total: number
  onClose: () => void
}

/**
 * コメント欄。下から出てくる。
 *
 * 中身は動画の ID から決まるので、本物か AI かの手がかりにはならない。
 * ループが増えるほど、こちらに気づいているような書き込みが上に混ざる。
 */
export function CommentSheet({ clipId, loops, total, onClose }: Props) {
  const comments = commentsFor(clipId, loops)

  return (
    <div className="sheet-backdrop" onPointerDown={onClose} role="presentation">
      <div
        className="comment-sheet"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="コメント"
      >
        <div className="sheet-head">
          <span className="sheet-title">コメント {formatCount(total)}</span>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="コメントを閉じる">
            ✕
          </button>
        </div>

        <ul className="comment-list">
          {comments.map((c, i) => (
            <li key={i}>
              <p className="comment-name">@{c.name}</p>
              <p className="comment-text">{c.text}</p>
              <p className="comment-likes">♥ {c.likes}</p>
            </li>
          ))}
        </ul>

        <p className="comment-foot">コメントの読み込みはここまでです</p>
      </div>
    </div>
  )
}
