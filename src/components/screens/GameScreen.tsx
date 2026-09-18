import { useCallback, useRef } from 'react'
import type { Verdict } from '../../core/types'
import { currentClip, preloadClips, type Session } from '../../core/session'
import { reelLabel } from '../../config/intertitles.data'
import { RULES } from '../../config/tuning'
import { Projector } from '../game/Projector'
import { VideoStage, type VideoStageHandle } from '../game/VideoStage'

interface Props {
  session: Session
  onAnswer: (verdict: Verdict) => void
  onReplay: () => void
}

export function GameScreen({ session, onAnswer, onReplay }: Props) {
  const stage = useRef<VideoStageHandle>(null)
  const clip = currentClip(session)
  const preload = preloadClips(session)
  const { reel, clearedInReel, stats } = session.progress

  const replay = useCallback(() => {
    stage.current?.replay()
    onReplay()
  }, [onReplay])

  if (!clip) return <p className="center-message">フィルムを巻いています…</p>

  return (
    <>
      <div className="upper">
        <Projector onReplay={replay} />
        <div className="reel-label">{reelLabel(reel)}</div>
        <div className="reel-dots" aria-label={`この巻 ${clearedInReel}/${RULES.clipsPerReel}`}>
          {Array.from({ length: RULES.clipsPerReel }, (_, i) => (
            <span key={i} className={i < clearedInReel ? 'dot on' : 'dot'} />
          ))}
        </div>
      </div>

      <VideoStage
        ref={stage}
        current={clip}
        turn={stats.presented}
        preload={preload}
        onAnswer={onAnswer}
        enabled
      />

      <div className="lower">
        <div className="hint" style={{ opacity: stats.presented >= 6 ? 0.3 : 1 }}>
          <span>
            ← <b>焼き捨てる</b>
          </span>
          <span>
            <b>映写する</b> →
          </span>
        </div>
        <button type="button" className="replay-link" onClick={replay}>
          もう一度映写する
        </button>
      </div>
    </>
  )
}
