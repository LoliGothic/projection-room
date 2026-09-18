import { useCallback, useEffect, useRef, useState } from 'react'
import type { Verdict } from '../core/types'
import { SWIPE } from '../config/tuning'

/**
 * 左右スワイプ / マウスドラッグ / 矢印キーを 1 つの入力にまとめる。
 * 右 = 映写する（project）、左 = 焼き捨てる（burn）。
 */
export function useSwipeInput(onCommit: (v: Verdict) => void, enabled: boolean) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const axis = useRef<'none' | 'x' | 'y'>('none')

  const commit = useCallback(
    (v: Verdict) => {
      if (!enabled) return
      setDx(0)
      setDragging(false)
      start.current = null
      axis.current = 'none'
      onCommit(v)
    },
    [enabled, onCommit],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
      axis.current = 'none'
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    // 最初の動きで縦スクロールか横スワイプかを決める
    if (axis.current === 'none' && Math.hypot(mx, my) > 8) {
      axis.current = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    }
    if (axis.current === 'y') return
    setDx(mx)
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current
      if (!s || s.id !== e.pointerId) return
      const mx = e.clientX - s.x
      const dt = Math.max(1, e.timeStamp - s.t)
      const speed = Math.abs(mx) / dt
      start.current = null
      axis.current = 'none'
      if (Math.abs(mx) >= SWIPE.commitDistance || (speed >= SWIPE.commitVelocity && Math.abs(mx) > 24)) {
        commit(mx > 0 ? 'project' : 'burn')
      } else {
        setDx(0)
        setDragging(false)
      }
    },
    [commit],
  )

  /** 途中でブラウザに操作を横取りされたときは、確定させずに戻す */
  const onPointerCancel = useCallback(() => {
    start.current = null
    axis.current = 'none'
    setDx(0)
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'ArrowRight') { e.preventDefault(); commit('project') }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); commit('burn') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, commit])

  /** -1..1 に正規化した進捗（表示用） */
  const progress = Math.max(-1, Math.min(1, dx / SWIPE.commitDistance))

  return {
    dx,
    dragging,
    progress,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
