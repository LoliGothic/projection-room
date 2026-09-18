import type { Intertitle } from '../../config/intertitles.data'
import { reelLabel } from '../../config/intertitles.data'
import { CUTSCENE } from '../../config/tuning'
import { useTimeout } from '../../hooks/useTimeout'

interface Props {
  card: Intertitle
  reel: number
  onDone: () => void
}

/** 巻の節目に挟む暗転＋無声映画風の字幕カード */
export function IntertitleScreen({ card, reel, onDone }: Props) {
  useTimeout(onDone, CUTSCENE.intertitleMs)

  return (
    <div className="cutscene" onPointerDown={onDone} role="presentation">
      <div className="intertitle">
        <div className="intertitle-reel">{reelLabel(reel)}</div>
        <p className="intertitle-main">{card.main}</p>
        {card.sub && <p className="intertitle-sub">{card.sub}</p>}
      </div>
    </div>
  )
}
