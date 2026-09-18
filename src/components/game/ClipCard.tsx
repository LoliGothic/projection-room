import { useEffect, useRef } from 'react'
import type { Clip, Verdict } from '../../core/types'
import { SWIPE } from '../../config/tuning'
import { useSwipeInput } from '../../hooks/useSwipeInput'

interface Props {
  clip: Clip
  onAnswer: (verdict: Verdict) => void
  enabled: boolean
}

/**
 * 4:3 の映像カード。1 回だけ再生し、終わったら最後のフレームで止まる。
 */
export function ClipCard({ clip, onAnswer, enabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { dx, dragging, progress, handlers } = useSwipeInput(onAnswer, enabled)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    void v.play().catch(() => {
      /* 自動再生が拒否されても最初のフレームは見えるので握りつぶす */
    })
  }, [clip.id])

  const tilt = progress * SWIPE.maxTiltDeg

  return (
    <div className="gate">
      <span className="perf left" aria-hidden="true" />
      <span className="perf right" aria-hidden="true" />
      <div
        className={dragging ? 'card' : 'card settling'}
        style={{ transform: `translateX(${dx}px) rotate(${tilt}deg)` }}
        {...handlers}
      >
        <video
          ref={videoRef}
          key={clip.id}
          src={clip.src}
          muted
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
        />
      </div>
      <span className="verdict burn" style={{ opacity: Math.max(0, -progress) * 0.85 }}>
        焼き捨てる
      </span>
      <span className="verdict project" style={{ opacity: Math.max(0, progress) * 0.85 }}>
        映写する
      </span>
    </div>
  )
}
