import { useEffect, useRef } from 'react'

interface Props {
  /** 0..1 */
  intensity: number
  /** 演出を軽くする：毎フレーム描き直さず静止したテクスチャにする */
  light: boolean
}

const NOISE_W = 128
const NOISE_H = 96

/**
 * フィルムの粒子と傷。動画ファイルは加工せず canvas の重ね描きだけで出す。
 */
export function FilmGrain({ intensity, light }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el || intensity <= 0) return
    const ctx = el.getContext('2d', { alpha: true })
    if (!ctx) return

    el.width = NOISE_W
    el.height = NOISE_H
    ctx.imageSmoothingEnabled = false

    const image = ctx.createImageData(NOISE_W, NOISE_H)
    const strength = 90 * intensity

    const drawNoise = () => {
      const d = image.data
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * strength
        d[i] = d[i + 1] = d[i + 2] = 255
        d[i + 3] = v
      }
      ctx.putImageData(image, 0, 0)

      // フィルムの傷：細い縦線をたまに引く
      if (Math.random() < 0.22 * intensity) {
        const x = Math.floor(Math.random() * NOISE_W)
        ctx.fillStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.2})`
        ctx.fillRect(x, 0, 1, NOISE_H)
      }
      // ごみ（黒い点）
      if (Math.random() < 0.3 * intensity) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(Math.random() * NOISE_W, Math.random() * NOISE_H, 1, 1 + Math.random() * 2)
      }
    }

    if (light) {
      drawNoise()
      return
    }

    let raf = 0
    let last = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      // 18fps 相当。粒子が動きすぎるとちらつきに見える
      if (now - last < 55) return
      last = now
      drawNoise()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [intensity, light])

  if (intensity <= 0) return null

  return <canvas ref={canvas} className="film-grain" aria-hidden="true" />
}
