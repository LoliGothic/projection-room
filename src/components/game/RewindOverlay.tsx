import { useEffect, useState } from 'react'
import { seenFrames } from '../../state/seenFrames'

interface Props {
  /** 巻き戻している時間（ms） */
  durationMs: number
  /** 演出を弱める：速度と歪みを控えめにする */
  softened?: boolean
}

/**
 * 間違えたときの巻き戻し。
 *
 * 送ってきた投稿を逆にさかのぼって、一本目まで戻る。
 * 画面が壊れる見せ方をやめてこちらにしたのは、「戻された」ことが
 * 一目で伝わるうえ、フィードという作りからも外れないため。
 *
 * 動かしているのは送るたびに取っておいた静止画で、動画は読み直さない。
 * 読み込みを待っていては、この短い時間に間に合わない。
 */
export function RewindOverlay({ durationMs, softened = false }: Props) {
  const frames = seenFrames()
  const last = frames.length - 1
  const [at, setAt] = useState(last)

  useEffect(() => {
    // 積み終わってから動かす。同じフレームで指定すると transition が効かない
    const id = requestAnimationFrame(() => setAt(0))
    return () => cancelAnimationFrame(id)
  }, [])

  // 戻る先が無いときは、揺さぶるだけにする
  if (frames.length < 2) {
    return <div className="rewind-overlay jolt" role="presentation" />
  }

  return (
    <div className="rewind-overlay" role="presentation">
      <div
        className={softened ? 'rewind-stack' : 'rewind-stack blurred'}
        style={{
          transform: `translateY(${-at * 100}%)`,
          transitionDuration: `${durationMs}ms`,
          // だんだん速くなって、一本目で止まる
          transitionTimingFunction: softened
            ? 'ease-in-out'
            : 'cubic-bezier(0.5, 0, 0.85, 0.5)',
        }}
      >
        {frames.map((src, i) => (
          <div className="rewind-frame" key={i}>
            <img src={src} alt="" draggable={false} />
          </div>
        ))}
      </div>
      {!softened && <div className="rewind-streaks" />}
    </div>
  )
}
