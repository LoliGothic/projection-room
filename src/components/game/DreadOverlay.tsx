import { DREAD } from '../../config/tuning'

interface Props {
  /** 0..1 */
  intensity: number
}

/**
 * 不穏タイマーに応じて映像のふちを締める。
 * 中央 60% には一切かからないよう、マスクで中心を抜いている。
 */
export function DreadOverlay({ intensity }: Props) {
  if (intensity <= 0.01) return null

  const inner = (DREAD.safeCenterRatio / 2) * 100
  const mask = `radial-gradient(ellipse at center, transparent ${inner}%, #000 ${Math.min(
    99,
    inner + 34,
  )}%)`

  return (
    <div
      className="dread-overlay"
      style={{
        opacity: intensity * 0.85,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
      aria-hidden="true"
    />
  )
}
