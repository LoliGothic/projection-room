import { useCallback, useRef } from 'react'
import { FEED } from '../config/tuning'

/**
 * 映像のタップを拾う。
 *
 * 判定はハートと報告ボタンで行うので、ここでは「軽く触れただけか」だけを見る。
 * スクロールしようとした指や、長押しは無視する。
 */
export function useTapInput(onTap: () => void, enabled: boolean) {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    },
    [enabled],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s || s.id !== e.pointerId) return
      const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y)
      const held = e.timeStamp - s.t
      if (moved < FEED.tapSlopPx && held < FEED.tapMaxMs) onTap()
    },
    [onTap],
  )

  const onPointerCancel = useCallback(() => {
    start.current = null
  }, [])

  return { handlers: { onPointerDown, onPointerUp, onPointerCancel } }
}
