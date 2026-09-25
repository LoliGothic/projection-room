import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Clip, Verdict } from '../../core/types'
import { buildSlots } from '../../core/videoRing'
import { RULES, SWIPE } from '../../config/tuning'
import { useSwipeInput } from '../../hooks/useSwipeInput'

export interface FeedVideoHandle {
  /** 最初から再生し直す */
  replay: () => void
}

interface Props {
  current: Clip
  /** これまでにデッキを進めた回数。スロット割り当てに使う */
  turn: number
  /** 先読みしておく動画 */
  preload: readonly Clip[]
  onAnswer: (verdict: Verdict) => void
  enabled: boolean
  /** 演出中は映像も止める */
  paused?: boolean
  ref?: React.Ref<FeedVideoHandle>
}

const SLOT_COUNT = RULES.preloadAhead + 1

/**
 * 9:16 の映像。<video> を固定数のスロットで使い回し、
 * 表示中の1本の裏で次の2本を読み込んでおく。
 */
export function FeedVideo({
  current,
  turn,
  preload,
  onAnswer,
  enabled,
  paused = false,
  ref,
}: Props) {
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const { dx, dragging, progress, handlers } = useSwipeInput(onAnswer, enabled)

  const wanted = useMemo(
    () => [current.id, ...preload.map((c) => c.id)].slice(0, SLOT_COUNT),
    [current.id, preload],
  )
  const byId = useMemo(() => {
    const m = new Map<string, Clip>()
    m.set(current.id, current)
    for (const c of preload) m.set(c.id, c)
    return m
  }, [current, preload])

  // 割り当ては turn だけから決まるので、状態も ref も持たずに済む
  const slots = useMemo(() => buildSlots(turn, wanted, SLOT_COUNT), [turn, wanted])
  const activeSlot = slots.indexOf(current.id)

  // 表示中のスロットだけ頭から再生する。ほかは読み込みだけ
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return
      if (i === activeSlot) {
        v.currentTime = 0
        void v.play().catch(() => {})
      } else if (!v.paused) {
        v.pause()
      }
    })
  }, [activeSlot, current.id])

  useEffect(() => {
    const v = videos.current[activeSlot]
    if (!v) return
    if (paused) v.pause()
    else void v.play().catch(() => {})
  }, [paused, activeSlot])

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        const v = videos.current[activeSlot]
        if (!v) return
        v.currentTime = 0
        void v.play().catch(() => {})
      },
    }),
    [activeSlot],
  )

  const tilt = progress * SWIPE.maxTiltDeg

  return (
    <div className="feed-video">
      <div
        className={dragging ? 'swipe-card' : 'swipe-card settling'}
        style={{ transform: `translateX(${dx}px) rotate(${tilt}deg)` }}
        {...handlers}
      >
        {slots.map((id, i) => {
          const clip = id ? byId.get(id) : undefined
          return (
            <video
              key={i}
              ref={(el) => {
                videos.current[i] = el
              }}
              src={clip?.src}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              // 3枚を必ず重ねる。ここを外すと先読み分が縦に並んではみ出す
              style={{
                position: 'absolute',
                inset: 0,
                opacity: i === activeSlot ? 1 : 0,
                zIndex: i === activeSlot ? 1 : 0,
              }}
            />
          )
        })}
      </div>

      <span className="verdict report" style={{ opacity: Math.max(0, -progress) * 0.9 }}>
        報告
      </span>
      <span className="verdict keep" style={{ opacity: Math.max(0, progress) * 0.9 }}>
        残す
      </span>
    </div>
  )
}
