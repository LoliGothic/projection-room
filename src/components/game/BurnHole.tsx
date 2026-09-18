import { useEffect, useRef } from 'react'

interface Props {
  /** 穴が広がりきるまでの時間（ms） */
  durationMs: number
  /** 演出を軽くする：縁の光をぼかさず、形の揺れも止める */
  light?: boolean
  /** 点滅を弱める：穴から光を抜かず、焦げた茶色のままにする */
  dim?: boolean
}

/** 穴のふちを描く分割数 */
const SEGMENTS = 96
/** 変色が始まってから穴が開くまでの間（全体に対する割合） */
const HOLE_DELAY = 0.18
/** この時点からランプが落ちていく（全体に対する割合） */
const LAMP_OFF = 0.7

/**
 * 映写機が止まり、ゲートで止まったフィルムが焼け落ちる。
 *
 * 大事なのは「穴は明るい」こと。フィルムに穴が開くと映写機のランプの光が
 * そのまま抜けるので、白く光る。穴を黒くすると焦げではなく
 * 何かに飲み込まれるように見えてしまう。
 *
 * 重ねているもの:
 *  ・先に乳剤が茶色く変色する（穴より少し早く広がる）
 *  ・そのふちが赤熱する
 *  ・遅れて穴が開き、ランプの光が抜ける
 *  ・遅れて小さな穴がいくつか開く
 */
export function BurnHole({ durationMs, light = false, dim = false }: Props) {
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

    /**
     * 焦げ跡ひとつぶん。
     * scorchR = 変色が広がっている半径 / holeR = 実際に穴が開いている半径。
     * 変色が先に進み、少し遅れて穴が追いかける。
     */
    const drawHole = (
      cx: number,
      cy: number,
      scorchR: number,
      holeR: number,
      offset: number,
      phase: number,
    ) => {
      if (scorchR < 1) return

      // ① 乳剤が茶色く変色して、外へ向かって薄くなる
      const scorch = ctx.createRadialGradient(cx, cy, scorchR * 0.2, cx, cy, scorchR * 1.55)
      scorch.addColorStop(0, 'rgba(26, 13, 6, 0.95)')
      scorch.addColorStop(0.55, 'rgba(58, 30, 13, 0.75)')
      scorch.addColorStop(0.82, 'rgba(96, 52, 22, 0.32)')
      scorch.addColorStop(1, 'rgba(96, 52, 22, 0)')
      ctx.fillStyle = scorch
      blob(cx, cy, scorchR * 1.55, offset, phase)
      ctx.fill()

      // ② 変色のふちが赤熱する
      const ember = ctx.createRadialGradient(cx, cy, scorchR * 0.55, cx, cy, scorchR * 1.12)
      ember.addColorStop(0, 'rgba(255, 176, 74, 0)')
      ember.addColorStop(0.72, 'rgba(255, 138, 40, 0.55)')
      ember.addColorStop(0.93, 'rgba(255, 96, 22, 0.75)')
      ember.addColorStop(1, 'rgba(120, 40, 8, 0)')
      ctx.fillStyle = ember
      blob(cx, cy, scorchR * 1.12, offset, phase)
      ctx.fill()

      if (holeR < 1) return

      // ③ 穴のふちは白熱している
      if (!light) {
        ctx.shadowColor = 'rgba(255, 186, 96, 0.9)'
        ctx.shadowBlur = Math.min(60, holeR * 0.5)
      }
      ctx.fillStyle = dim ? 'rgba(70, 38, 16, 0.95)' : 'rgba(255, 214, 150, 0.95)'
      blob(cx, cy, holeR * 1.06, offset, phase)
      ctx.fill()
      ctx.shadowBlur = 0

      // ④ 穴。映写機のランプの光がそのまま抜ける
      ctx.fillStyle = dim ? '#160b04' : '#e8dfcd'
      blob(cx, cy, holeR, offset, phase)
      ctx.fill()
    }

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      ctx.clearRect(0, 0, w, h)

      const phase = light ? 0 : t * 14
      // 変色が先。穴はワンテンポ遅れて追いかける
      const scorchR = maxR * Math.pow(t, 2.0)
      const holeT = Math.max(0, (t - HOLE_DELAY) / (1 - HOLE_DELAY))
      const holeR = maxR * 0.92 * Math.pow(holeT, 2.1)

      for (const s of spots) {
        if (t <= s.delay) continue
        const st = (t - s.delay) / (1 - s.delay)
        const sr = maxR * s.scale
        drawHole(s.x, s.y, sr * Math.pow(st, 1.7), sr * 0.9 * Math.pow(Math.max(0, st - 0.2) / 0.8, 1.9), s.seed, phase)
      }
      drawHole(main.x, main.y, scorchR, holeR, 0, phase)

      // 穴が画面を覆いきる頃、映写機のランプが落ちる。
      // 一面が白いまま終わると眩しいので、ここで暗転へつなげる
      if (t > LAMP_OFF) {
        const fade = Math.pow((t - LAMP_OFF) / (1 - LAMP_OFF), 1.4) * 0.94
        ctx.fillStyle = `rgba(0, 0, 0, ${fade.toFixed(3)})`
        ctx.fillRect(0, 0, w, h)
      }

      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, light, dim])

  return <canvas ref={canvas} className="burn-hole" aria-hidden="true" />
}
