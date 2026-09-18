import { useEffect, type RefObject } from 'react'
import { FX } from '../config/tuning'

/**
 * 「古いフィルムが映写されている」揺れと明るさのゆらぎ。
 * React の再レンダーを起こさず、CSS 変数を直接書き換える。
 *
 * - 毎フレーム 0〜2px のランダムな揺れ
 * - 数十秒に一度だけ上下に数px跳ねる
 * - 明るさを 1〜3% の範囲でゆっくり揺らす（点滅に見えない速さ）
 */
export function useFilmMotion(
  target: RefObject<HTMLElement | null>,
  enabled: boolean,
  intensity: number,
) {
  useEffect(() => {
    const el = target.current
    if (!el) return

    if (!enabled || intensity <= 0) {
      el.style.setProperty('--jitter-x', '0px')
      el.style.setProperty('--jitter-y', '0px')
      el.style.setProperty('--gate-brightness', '1')
      return
    }

    let raf = 0
    let last = 0
    let hopUntil = 0
    let nextHop = performance.now() + randomBetween(...FX.hopIntervalMs)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      // 24fps 相当に落とす（映写のがたつきとしてもこのくらいが自然）
      if (now - last < 41) return
      last = now

      if (now >= nextHop) {
        hopUntil = now + 160
        nextHop = now + randomBetween(...FX.hopIntervalMs)
      }

      const amp = FX.jitterPx * intensity
      const x = (Math.random() - 0.5) * 2 * amp
      let y = (Math.random() - 0.5) * 2 * amp
      if (now < hopUntil) y += FX.hopPx * intensity * (1 - (hopUntil - now) / 160)

      // ゆっくりした呼吸のような明滅。周期をずらした 2 つの sin を重ねる
      const w = FX.brightnessWobble * intensity
      const b = 1 + (Math.sin(now / 1700) * 0.6 + Math.sin(now / 640) * 0.4) * w

      el.style.setProperty('--jitter-x', `${x.toFixed(2)}px`)
      el.style.setProperty('--jitter-y', `${y.toFixed(2)}px`)
      el.style.setProperty('--gate-brightness', b.toFixed(3))
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.style.setProperty('--jitter-x', '0px')
      el.style.setProperty('--jitter-y', '0px')
      el.style.setProperty('--gate-brightness', '1')
    }
  }, [target, enabled, intensity])
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
