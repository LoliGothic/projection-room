import { useEffect, useRef, useState } from 'react'
import { dreadAt, type Dread } from '../core/dread'

const ZERO: Dread = { stage: 0, progress: 0, intensity: 0, dark: false }

interface Sample {
  key: number
  dread: Dread
}

/**
 * 1 本の動画が表示されてからの経過時間を測る。
 * resetKey が変わったときだけ 0 に戻るので、リプレイではリセットされない。
 * 最後の段階に達したら onDark を 1 回だけ呼ぶ。
 */
export function useDreadTimer(active: boolean, resetKey: number, onDark: () => void): Dread {
  const [sample, setSample] = useState<Sample>({ key: resetKey, dread: ZERO })
  const onDarkRef = useRef(onDark)

  useEffect(() => {
    onDarkRef.current = onDark
  })

  useEffect(() => {
    if (!active) return

    const started = performance.now()
    let raf = 0
    let fired = false
    let last = -1

    const tick = (now: number) => {
      const dread = dreadAt(now - started)
      // 毎フレーム setState しないよう、値が実質変わったときだけ更新する
      const quantized = Math.round(dread.intensity * 200)
      if (quantized !== last) {
        last = quantized
        setSample({ key: resetKey, dread })
      }
      if (dread.dark && !fired) {
        fired = true
        onDarkRef.current()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, resetKey])

  // 動画が切り替わった直後や、プレイ中でないときは 0 を返す
  return active && sample.key === resetKey ? sample.dread : ZERO
}
