import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Clip } from '../../core/types'
import { endingById, fillCard, type EndingNumbers } from '../../config/endings.data'
import { Backdrop } from '../Backdrop'

interface Props {
  endingId: string
  /** 演出用動画（clips.json に置いてある場合） */
  clip?: Clip
  /** 文中に差し込む、その回の数字 */
  numbers?: EndingNumbers
  onRecap: () => void
  onHome: () => void
}

/** 最初の文が出るまで暗いまま待つ時間の既定。エンディングごとに上書きできる */
const LEAD_MS = 0
/** 最後の文が消えてから、締めの画面が出るまでの既定 */
const SETTLE_MS = 1400
/**
 * エンディング。黒い画面に、文を1つずつ出しては消す。
 *
 * 囲いは付けず、積み上げもしない。並べて残すと台本のリストに見えるし、
 * 囲いを付けると、どれが通知でどれが画面なのかを見分けさせることになる。
 * 一度に一文だけ置くのが、いちばん逃げ場がない。
 *
 * 前後にどれだけ黙るかはエンディングごとに決める（leadMs / settleMs）。
 * 文を減らして間で持たせたいものだけ、長めに取る。
 */
export function EndingScreen({ endingId, clip, numbers, onRecap, onHome }: Props) {
  const ending = endingById(endingId)
  const cards = useMemo(() => ending?.cards ?? [], [ending])
  const lead = ending?.leadMs ?? LEAD_MS
  const settle = ending?.settleMs ?? SETTLE_MS
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(lead <= 0)
  const [settled, setSettled] = useState(false)
  const done = index >= cards.length

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, cards.length)), [cards.length])

  // 暗いまま待ってから最初の文を出す
  useEffect(() => {
    if (lead <= 0) return
    const id = window.setTimeout(() => setStarted(true), lead)
    return () => window.clearTimeout(id)
  }, [lead])

  useEffect(() => {
    if (!started || done) return
    const id = window.setTimeout(next, cards[index]?.holdMs ?? 2800)
    return () => window.clearTimeout(id)
  }, [started, index, done, next, cards])

  // 最後の文が消えたあと、少し黙ってから締める
  useEffect(() => {
    if (!started || !done) return
    const id = window.setTimeout(() => setSettled(true), settle)
    return () => window.clearTimeout(id)
  }, [started, done, settle])

  const current = started ? cards[index] : undefined

  if (!ending) {
    return (
      <div className="panel">
        <p className="center-message">アプリを終了しました。</p>
      </div>
    )
  }

  return (
    <div
      className="ending"
      onPointerDown={
        !started ? () => setStarted(true) : done ? undefined : next
      }
      role="presentation"
    >
      {ending.backdrop && <Backdrop src={ending.backdrop} fadeMs={ending.backdropFadeMs} />}

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

      {current && (
        <div className="ending-cards">
          {/* key を付けて、文が変わるたびに出現のアニメーションをやり直す */}
          <p key={index} className="ending-card">
            {fillCard(current.text, numbers)}
          </p>
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
