import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Clip } from '../../core/types'
import { endingById, fillCard, type EndingCard, type EndingNumbers } from '../../config/endings.data'

interface Props {
  endingId: string
  /** 演出用動画（clips.json に置いてある場合） */
  clip?: Clip
  /** 文中に差し込む、その回の数字 */
  numbers?: EndingNumbers
  onRecap: () => void
  onHome: () => void
}

/** 最後の文が消えてから、締めの画面が出るまで */
const SETTLE_MS = 1400
/** 通知が同時に見えている数。溜まっていく感じだけ出せばよい */
const NOTICE_STACK = 3

/**
 * エンディング。文章を1枚ずつ出していく。
 *
 * 通知として出した文は下に溜まり、画面そのものに出した文は前の文と入れ替わる。
 * 実際のアプリでもそう振る舞うので、並べ方だけで「これはアプリの画面だ」と
 * 伝わる。全部を積み上げると、ただの台本に見えてしまう。
 */
export function EndingScreen({ endingId, clip, numbers, onRecap, onHome }: Props) {
  const ending = endingById(endingId)
  const cards = useMemo(() => ending?.cards ?? [], [ending])
  const [index, setIndex] = useState(0)
  const [settled, setSettled] = useState(false)
  const done = index >= cards.length

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, cards.length)), [cards.length])

  useEffect(() => {
    if (done) return
    const id = window.setTimeout(next, cards[index]?.holdMs ?? 2800)
    return () => window.clearTimeout(id)
  }, [index, done, next, cards])

  // 最後の文が消えたあと、少し黙ってから締める
  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setSettled(true), SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [done])

  /**
   * いま見えている文。
   * 通知は直前まで続いた通知と一緒に溜まり、それ以外は1枚だけ残る。
   */
  const shown = useMemo(() => {
    const current = cards[index]
    if (!current) return []
    if (current.as !== 'notice') return [{ card: current, key: index }]
    const run: { card: EndingCard; key: number }[] = []
    for (let i = index; i >= 0 && cards[i].as === 'notice'; i--) {
      run.unshift({ card: cards[i], key: i })
    }
    return run.slice(-NOTICE_STACK)
  }, [cards, index])

  if (!ending) {
    return (
      <div className="panel">
        <p className="center-message">アプリを終了しました。</p>
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
          {shown.map(({ card, key }) => (
            <p
              key={key}
              className={`ending-card as-${card.as}${key === index ? ' now' : ''}`}
            >
              {fillCard(card.text, numbers)}
            </p>
          ))}
        </div>
      )}

      {settled && (
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
