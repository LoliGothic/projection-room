interface Props {
  /** リールの回転速度の倍率。不穏タイマーの段階で変わる */
  speed?: number
  /** 回転を止める（ミス演出・巻の節目） */
  stopped?: boolean
  onReplay?: () => void
}

/**
 * 上の余白に置く映写機。リールが回り、押すとリプレイできる。
 */
export function Projector({ speed = 1, stopped = false, onReplay }: Props) {
  const dur = stopped ? 0 : 2.4 / Math.max(0.2, speed)
  const style = stopped
    ? { animationPlayState: 'paused' as const }
    : { animationDuration: `${dur}s` }

  return (
    <button
      type="button"
      className="projector"
      onClick={onReplay}
      aria-label="もう一度映写する"
      title="もう一度映写する"
    >
      <svg viewBox="0 0 96 44" width="96" height="44" aria-hidden="true">
        {/* 光 */}
        <path className="beam" d="M70 22 L96 6 L96 38 Z" />
        {/* 本体 */}
        <rect x="18" y="16" width="52" height="18" rx="2" className="body" />
        <rect x="64" y="19" width="10" height="12" rx="1" className="body" />
        {/* リール */}
        <g className="reel" style={style} transform="translate(30 12)">
          <circle r="10" className="reel-rim" />
          <circle r="2.4" className="reel-hub" />
          <g className="reel-spokes">
            <rect x="-0.9" y="-9" width="1.8" height="5" />
            <rect x="-0.9" y="4" width="1.8" height="5" />
            <rect x="-9" y="-0.9" width="5" height="1.8" />
            <rect x="4" y="-0.9" width="5" height="1.8" />
          </g>
        </g>
        <g className="reel" style={style} transform="translate(58 12)">
          <circle r="8" className="reel-rim" />
          <circle r="2" className="reel-hub" />
          <g className="reel-spokes">
            <rect x="-0.8" y="-7" width="1.6" height="4" />
            <rect x="-0.8" y="3" width="1.6" height="4" />
            <rect x="-7" y="-0.8" width="4" height="1.6" />
            <rect x="3" y="-0.8" width="4" height="1.6" />
          </g>
        </g>
        {/* 脚 */}
        <rect x="40" y="34" width="8" height="8" className="body" />
        <rect x="30" y="41" width="28" height="3" rx="1.5" className="body" />
      </svg>
    </button>
  )
}
