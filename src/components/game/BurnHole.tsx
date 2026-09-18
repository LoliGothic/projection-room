import { useEffect, useRef } from 'react'

interface Props {
  /** 穴が広がりきるまでの時間（ms） */
  durationMs: number
  /** 演出を軽くする：縁の光をぼかさず、形の揺れも止める */
  light?: boolean
}

/** 穴のふちを描く分割数 */
const SEGMENTS = 96

/**
 * 映写機が止まり、ゲートで止まったフィルムが焼け落ちる。
 *
 * 正円を拡大するだけでは焦げに見えないので、
 *  ・ふちを角度ごとに歪ませた不定形の穴にする
 *  ・穴のまわりを橙〜黄の赤熱した縁で囲む
 *  ・その外側に茶色い焦げの滲みを置く
 *  ・遅れて小さな穴がいくつか開く
 * の 4 つを重ねている。
 */
export function BurnHole({ durationMs, light = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const rect = cv.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    ctx.scale(dpr, dpr)

    /**
     * ふちの歪み。角度ごとに独立した乱数を振ると歯車のようにギザギザになるので、
     * 波長の違う波を重ねて、大きなうねりの上に細かい凹凸が乗る形にする。
     */
    const harmonics = [
      { k: 2, amp: 0.17 },
      { k: 3, amp: 0.11 },
      { k: 5, amp: 0.07 },
      { k: 9, amp: 0.04 },
      { k: 15, amp: 0.02 },
    ].map((hm) => ({ ...hm, phase: Math.random() * Math.PI * 2 }))

    const edge = (a: number, offset: number) =>
      harmonics.reduce(
        (acc, hm) => acc + hm.amp * Math.sin(hm.k * a + hm.phase + offset),
        1,
      )

    const maxR = Math.hypot(w, h) * 0.82

    // 主穴はやや中心から外れた位置から。遅れて開く小さな穴も用意する
    const main = { x: w * (0.4 + Math.random() * 0.2), y: h * (0.4 + Math.random() * 0.2) }
    const spots = Array.from({ length: 3 }, () => ({
      x: w * (0.15 + Math.random() * 0.7),
      y: h * (0.15 + Math.random() * 0.7),
      scale: 0.18 + Math.random() * 0.22,
      delay: 0.3 + Math.random() * 0.35,
      // ふちの向きをずらして、同じ形の穴が並ばないようにする
      seed: Math.random() * Math.PI * 2,
    }))

    const blob = (cx: number, cy: number, r: number, offset: number, phase: number) => {
      ctx.beginPath()
      // 頂点どうしを曲線でつないで、多角形に見えないようにする
      let px = 0
      let py = 0
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2
        // じりじり焼け広がるよう、形をゆっくり回す
        const rr = r * edge(a, offset + (light ? 0 : phase * 0.12))
        const x = cx + Math.cos(a) * rr
        const y = cy + Math.sin(a) * rr
        if (i === 0) ctx.moveTo(x, y)
        else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
        px = x
        py = y
      }
      ctx.closePath()
    }

    /** 焦げ跡ひとつぶん（滲み → 赤熱した縁 → 穴）を描く */
    const drawHole = (
      cx: number,
      cy: number,
      r: number,
      offset: number,
      phase: number,
      heat: number,
    ) => {
      // 外側の茶色い滲み
      ctx.fillStyle = `rgba(48, 26, 12, ${0.5 * heat})`
      blob(cx, cy, r * 1.5, offset, phase)
      ctx.fill()

      // 赤熱した縁
      const glow = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.28)
      glow.addColorStop(0, `rgba(255, 208, 120, ${0.95 * heat})`)
      glow.addColorStop(0.45, `rgba(214, 96, 32, ${0.85 * heat})`)
      glow.addColorStop(1, 'rgba(90, 30, 8, 0)')
      ctx.fillStyle = glow
      if (!light) {
        ctx.shadowColor = `rgba(255, 150, 60, ${0.75 * heat})`
        ctx.shadowBlur = r * 0.35
      }
      blob(cx, cy, r * 1.22, offset, phase)
      ctx.fill()
      ctx.shadowBlur = 0

      // 穴そのもの
      ctx.fillStyle = '#000'
      blob(cx, cy, r, offset, phase)
      ctx.fill()
    }

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      ctx.clearRect(0, 0, w, h)

      const phase = light ? 0 : t * 14
      // ゆっくり始まって一気に広がる
      const r = maxR * Math.pow(t, 2.2)
      // 広がりきる頃には熱が引く
      const heat = Math.min(1, t * 4) * (1 - Math.pow(t, 3) * 0.55)

      for (const s of spots) {
        if (t <= s.delay) continue
        const st = (t - s.delay) / (1 - s.delay)
        drawHole(s.x, s.y, maxR * s.scale * Math.pow(st, 1.8), s.seed, phase, heat)
      }
      drawHole(main.x, main.y, r, 0, phase, heat)

      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, light])

  return <canvas ref={canvas} className="burn-hole" aria-hidden="true" />
}
