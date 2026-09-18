import { useCallback, useEffect, useState } from 'react'
import type { Clip } from '../../core/types'
import { endingById } from '../../config/endings.data'

interface Props {
  endingId: string
  /** 演出用動画（clips.json に置いてある場合） */
  clip?: Clip
  onRecap: () => void
  onTitle: () => void
}

const CARD_MS = 3400

/** 字幕カードを 1 枚ずつ出していくエンディング画面 */
export function EndingScreen({ endingId, clip, onRecap, onTitle }: Props) {
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
      <div className="cutscene">
        <p className="center-message">上映は終わった。</p>
      </div>
    )
  }

  return (
    <div className="cutscene ending" onPointerDown={done ? undefined : next} role="presentation">
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
        <div className="intertitle">
          <p className="intertitle-main">{cards[index]}</p>
        </div>
      )}

      {done && (
        <div className="ending-final">
          <div className="intertitle-reel">終幕</div>
          <h2 className="ending-title">{ending.title}</h2>
          <div className="ending-actions">
            <button type="button" className="title-start" onClick={onRecap}>
              振り返る
            </button>
            <button type="button" className="ghost-button" onClick={onTitle}>
              映写室を出る
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
