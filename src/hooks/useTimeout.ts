import { useEffect, useRef } from 'react'

/** ms 後に fn を 1 回だけ呼ぶ。ms が null の間は止まる。 */
export function useTimeout(fn: () => void, ms: number | null) {
  const saved = useRef(fn)

  useEffect(() => {
    saved.current = fn
  })

  useEffect(() => {
    if (ms === null) return
    const id = window.setTimeout(() => saved.current(), ms)
    return () => window.clearTimeout(id)
  }, [ms])
}
