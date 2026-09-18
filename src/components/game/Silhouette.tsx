interface Props {
  /** 0..1。1 に近いほど大きく濃く、こちらに寄る */
  closeness: number
  place: 'upper' | 'lower'
}

/**
 * 上下の余白に現れる人影。視界は悪くせず、余白の中だけで近づく。
 */
export function Silhouette({ closeness, place }: Props) {
  if (closeness <= 0.02) return null

  const scale = 0.55 + closeness * 0.75
  const opacity = 0.1 + closeness * 0.5

  return (
    <div
      className={`silhouette ${place}`}
      style={{ opacity, transform: `translateX(-50%) scale(${scale})` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 60 70" width="60" height="70">
        <ellipse cx="30" cy="18" rx="11" ry="13" />
        <path d="M30 31 C13 31 6 45 4 70 L56 70 C54 45 47 31 30 31 Z" />
      </svg>
    </div>
  )
}
