import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Clip } from '../../core/types'
import { buildSlots } from '../../core/videoRing'
import { FEED, RULES } from '../../config/tuning'
import { useTapInput } from '../../hooks/useTapInput'

export interface FeedVideoHandle {
  /** 最初から再生し直す */
  replay: () => void
}

interface Props {
  current: Clip
  /** ひとつ前に出ていた 1 本。上へ抜けていく側 */
  previous?: Clip
  /** これまでにデッキを進めた回数。スロット割り当てに使う */
  turn: number
  /** 先読みしておく動画 */
  preload: readonly Clip[]
  /** 映像をタップしたとき（頭出し） */
  onTap?: () => void
  /** 動画が読み込めなかったとき */
  onVideoError?: () => void
  enabled: boolean
  /** 演出中は映像も止める */
  paused?: boolean
  ref?: React.Ref<FeedVideoHandle>
}

/** 上へ抜けた1本 + 表示中 + 先読み2本 */
const SLOT_COUNT = RULES.preloadAhead + 2

/**
 * 縦に送るフィード。
 *
 * 回答すると、いまの1本が上へ抜け、次の1本が下から上がってくる。
 * <video> は固定数のスロットで使い回す。ids の並びをひとつずらすだけで
 * 各動画は同じスロットに留まるので、要素を作り直さずに動かせる。
 */
export function FeedVideo({
  current,
  previous,
  turn,
  preload,
  onTap,
  onVideoError,
  enabled,
  paused = false,
  ref,
}: Props) {
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const { handlers } = useTapInput(onTap ?? (() => {}), enabled)

  // 上へ抜けた1本 → 表示中 → 先読み、の順
  const ids = useMemo(
    () => [previous?.id, current.id, ...preload.map((c) => c.id)].slice(0, SLOT_COUNT),
    [previous?.id, current.id, preload],
  )
  const byId = useMemo(() => {
    const m = new Map<string, Clip>()
    if (previous) m.set(previous.id, previous)
    m.set(current.id, current)
    for (const c of preload) m.set(c.id, c)
    return m
  }, [previous, current, preload])

  const slots = useMemo(() => buildSlots(turn, ids, SLOT_COUNT), [turn, ids])
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

  return (
    <div className="feed-video" {...handlers}>
      {slots.map((id, i) => {
        const clip = id ? byId.get(id) : undefined
        // ids の何番目か＝画面のどこに置くか。0=上へ抜けた 1=表示中 2以降=下に控える
        const offset = id ? ids.indexOf(id) : -1
        const y = offset < 0 ? 100 : (offset - 1) * 100
        return (
          <div
            key={i}
            className="feed-slot"
            style={{
              transform: `translateY(${y}%)`,
              transitionDuration: `${FEED.scrollMs}ms`,
              // 表示中と、その前後だけ見えていればよい
              visibility: Math.abs(y) <= 100 ? 'visible' : 'hidden',
            }}
          >
            <video
              ref={(el) => {
                videos.current[i] = el
              }}
              src={clip?.src}
              muted
              playsInline
              autoPlay
              loop
              preload="auto"
              disablePictureInPicture
              onError={i === activeSlot ? onVideoError : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}
