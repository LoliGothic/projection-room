import { useEffect, useRef } from 'react'

interface Props {
  /** 乱れている時間（ms） */
  durationMs: number
  /** 演出を弱める：帯のずれと明滅を控えめにする */
  softened?: boolean
}

/**
 * 画面が壊れる演出。
 *
 * 「読み込み中」のぐるぐるだと通信が遅いだけに見えてしまうので、
 * いま止まっているフレームを取り込んで、それ自体を壊す。
 *  ・横方向の帯がずれる（走査線のずれ）
 *  ・帯ごとに色がずれる
 *  ・細かい砂嵐が乗る
 *  ・ときどき横一線の裂け目が走る
 *
 * 強い明滅は使わない。設定の「演出を弱める」ではずれ幅と頻度を落とす。
 */
export function GlitchOverlay({ durationMs, softened = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d', { alpha: false })
    if (!ctx) return

    const rect = cv.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    cv.width = w
    cv.height = h

    // いま映っているコマを取り込む。取れなければ暗い下地だけで進める
    const frame = document.createElement('canvas')
    frame.width = w
    frame.height = h
    const fctx = frame.getContext('2d')
    const shown = [...document.querySelectorAll('.swipe-card video')].find(
      (v) => (v as HTMLElement).style.opacity === '1',
    ) as HTMLVideoElement | undefined

    let hasFrame = false
    if (fctx && shown && shown.videoWidth > 0) {
      try {
        // 9:16 に切り出して描く（object-fit: cover と同じ見え方に）
        const scale = Math.max(w / shown.videoWidth, h / shown.videoHeight)
        const dw = shown.videoWidth * scale
        const dh = shown.videoHeight * scale
        fctx.drawImage(shown, (w - dw) / 2, (h - dh) / 2, dw, dh)
        hasFrame = true
      } catch {
        /* 読めなければ下地だけで進める */
      }
    }

    const sliceCount = softened ? 7 : 16
    const maxShift = (softened ? 0.03 : 0.11) * w

    // 砂嵐は小さく作って引き伸ばす
    const noise = document.createElement('canvas')
    noise.width = 96
    noise.height = 170
    const nctx = noise.getContext('2d')
    const noiseImage = nctx?.createImageData(noise.width, noise.height)

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // 後半ほど激しく、最後は暗転へ向かう
      const power = Math.sin(Math.min(1, t * 1.15) * Math.PI) * (softened ? 0.55 : 1)

      ctx.fillStyle = '#05050a'
      ctx.fillRect(0, 0, w, h)

      if (hasFrame) {
        // 帯ごとに横へずらす
        const bands = Math.round(2 + sliceCount * power)
        let y = 0
        for (let i = 0; i < bands; i++) {
          const bh = Math.max(4, Math.round((h / bands) * (0.5 + Math.random())))
          const shift = (Math.random() - 0.5) * 2 * maxShift * power
          ctx.drawImage(frame, 0, y, w, bh, shift, y, w, bh)

          // ときどき色をずらす
          if (Math.random() < 0.22 * power) {
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = 0.35 * power
            ctx.fillStyle = Math.random() < 0.5 ? '#ff2d55' : '#2de0ff'
            ctx.fillRect(shift, y, w, bh)
            ctx.globalAlpha = 1
            ctx.globalCompositeOperation = 'source-over'
          }
          y += bh
          if (y >= h) break
        }
      }

      // 砂嵐
      if (nctx && noiseImage) {
        const d = noiseImage.data
        const strength = 70 * power
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.random() * strength
          d[i] = d[i + 1] = d[i + 2] = 255
          d[i + 3] = v
        }
        nctx.putImageData(noiseImage, 0, 0)
        ctx.globalAlpha = 0.5
        ctx.drawImage(noise, 0, 0, w, h)
        ctx.globalAlpha = 1
      }

      // 横一線の裂け目
      if (Math.random() < 0.3 * power) {
        const ty = Math.random() * h
        ctx.fillStyle = `rgba(255,255,255,${(0.1 + Math.random() * 0.18) * power})`
        ctx.fillRect(0, ty, w, 1 + Math.random() * 3)
      }

      // 終わりに向けて暗くしていき、そのまま暗転へつなぐ
      if (t > 0.72) {
        const fade = Math.pow((t - 0.72) / 0.28, 1.3)
        ctx.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`
        ctx.fillRect(0, 0, w, h)
      }

      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, softened])

  return <canvas ref={canvas} className="glitch-overlay" aria-hidden="true" />
}
