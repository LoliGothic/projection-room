import { useCallback, useEffect, useState } from 'react'
import type { Clip } from '../../core/types'
import { endingById } from '../../config/endings.data'

interface Props {
  endingId: string
  /** 演出用動画（clips.json に置いてある場合） */
  clip?: Clip
  onRecap: () => void
  onHome: () => void
}

const CARD_MS = 3200

/** 通知やメッセージ風のテキストを1枚ずつ出していくエンディング画面 */
export function EndingScreen({ endingId, clip, onRecap, onHome }: Props) {
  const ending = endingById(endingId)
  const [index, setIndex] = useState(0)
  const cards = ending?.cards ?? []
  const done = index >= cards.length

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, cards.length)), [cards.length])

  useEffect(() => {
    if (done) return
    const id = window.setTimeout(next, CARD_MS)
    return () => window.clearTimeout(id)
  }, [index, done, next])

  if (!ending) {
    return (
      <div className="panel">
        <p className="center-message">アプリを閉じました。</p>
      </div>
    )
  }

  return (
    <div className="ending" onPointerDown={done ? undefined : next} role="presentation">
      {clip && (
        <video
          className="ending-clip"
          src={clip.src}
          muted
          playsInline
          autoPlay
          loop
          disablePictureInPicture
        />
      )}

      {!done && (
        <div className="ending-cards">
          {cards.slice(0, index + 1).map((text, i) => (
            <p key={i} className={i === index ? 'ending-card now' : 'ending-card'}>
              {text}
            </p>
          ))}
        </div>
      )}

      {done && (
        <div className="ending-final">
          <p className="ending-label">エンディング</p>
          <h2 className="ending-title">{ending.title}</h2>
          <div className="ending-actions">
            <button type="button" className="primary-button" onClick={onRecap}>
              振り返る
            </button>
            <button type="button" className="ghost-button" onClick={onHome}>
              ホームに戻る
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
