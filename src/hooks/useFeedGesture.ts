import { useCallback, useRef, useState } from 'react'
import { FEED } from '../config/tuning'

interface Options {
  /** 上へ送りきったとき（＝本物だと答える） */
  onAdvance: () => void
  /** 軽く触れただけのとき（＝頭出し） */
  onTap: () => void
  enabled: boolean
}

/**
 * 縦フィードの指の操作。
 *
 * 上へスクロールして送ること自体が「本物だと答える」ことになるので、
 * 指が滑ったくらいでは送られないよう、しきい値は大きめにしてある。
 * 下へは送れない（戻れない）ので、引っ張られても少ししか動かさない。
 */
export function useFeedGesture({ onAdvance, onTap, enabled }: Options) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const height = useRef(1)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      // ボタンやメニューを押したときは、送りの操作として扱わない
      if ((e.target as HTMLElement).closest('button, [role="menu"]')) return
      height.current = (e.currentTarget as HTMLElement).clientHeight || 1
      // 合成イベントの timeStamp は環境によって基準が違うので、自分で測る
      start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [enabled],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dy = e.clientY - s.y
    // 下方向（戻る側）には送れないので、引っ張りに抵抗をつける
    setDragY(dy < 0 ? dy : dy * FEED.overdragResist)
  }, [])

  const finish = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current
      if (!s || s.id !== e.pointerId) return
      start.current = null
      setDragging(false)

      const dy = e.clientY - s.y
      const dx = e.clientX - s.x
      const dt = Math.max(1, performance.now() - s.t)
      const speed = -dy / dt

      const far = -dy >= height.current * FEED.advanceRatio
      const fast = speed >= FEED.advanceVelocity && -dy > 24

      if (far || fast) {
        // 位置は戻さない。このまま次の1本へつながって見えるようにする
        setDragY(0)
        onAdvance()
        return
      }

      if (Math.abs(dy) < FEED.tapSlopPx && Math.abs(dx) < FEED.tapSlopPx && dt < FEED.tapMaxMs) {
        onTap()
      }
      setDragY(0)
    },
    [onAdvance, onTap],
  )

  const onPointerCancel = useCallback(() => {
    start.current = null
    setDragging(false)
    setDragY(0)
  }, [])

  return {
    dragY,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel,
    },
  }
}
