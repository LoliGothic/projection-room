import { useCallback, useEffect, useRef } from 'react'
import type { Verdict } from '../../core/types'
import { currentClip, preloadClips, type Session } from '../../core/session'
import { breathLevel, projectorSpeed, silhouetteCloseness } from '../../core/dread'
import { reelLabel } from '../../config/intertitles.data'
import { RULES } from '../../config/tuning'
import { useDreadTimer } from '../../hooks/useDreadTimer'
import { useSettings, effectiveFx } from '../../state/settingsStore'
import { audio } from '../../audio/engine'
import { Projector } from '../game/Projector'
import { DreadOverlay } from '../game/DreadOverlay'
import { Silhouette } from '../game/Silhouette'
import { VideoStage, type VideoStageHandle } from '../game/VideoStage'

interface Props {
  session: Session
  onAnswer: (verdict: Verdict) => void
  onReplay: () => void
  onDarkness: () => void
}

export function GameScreen({ session, onAnswer, onReplay, onDarkness }: Props) {
  const stage = useRef<VideoStageHandle>(null)
  const settings = useSettings()
  const clip = currentClip(session)
  const preload = preloadClips(session)
  const { reel, clearedInReel, stats } = session.progress

  // 経過時間は「回答した本数」が変わったときだけリセットする＝リプレイでは戻らない
  const dread = useDreadTimer(true, stats.presented, onDarkness)

  const fx = effectiveFx(settings)
  const closeness = silhouetteCloseness(dread, stats.loops) * fx
  const lamp = 0.25 + dread.intensity * 0.75

  // 音は外部システムなので効果として同期する
  useEffect(() => {
    audio.setDread(dread.intensity, breathLevel(dread))
  }, [dread])
  useEffect(() => {
    audio.setLoops(stats.loops)
  }, [stats.loops])

  const replay = useCallback(() => {
    stage.current?.replay()
    onReplay()
  }, [onReplay])

  if (!clip) return <p className="center-message">フィルムを巻いています…</p>

  return (
    <>
      <div className="upper">
        <span className="lamp" style={{ opacity: lamp }} aria-hidden="true" />
        <Silhouette closeness={closeness} place="upper" />
        <Projector speed={projectorSpeed(dread)} onReplay={replay} />
        <div className="reel-label">{reelLabel(reel)}</div>
        <div className="reel-dots" aria-label={`この巻 ${clearedInReel}/${RULES.clipsPerReel}`}>
          {Array.from({ length: RULES.clipsPerReel }, (_, i) => (
            <span key={i} className={i < clearedInReel ? 'dot on' : 'dot'} />
          ))}
        </div>
      </div>

      <div className="gate-wrap">
        <VideoStage
          ref={stage}
          current={clip}
          turn={stats.presented}
          preload={preload}
          onAnswer={onAnswer}
          enabled
        />
        <DreadOverlay intensity={dread.intensity * fx} />
      </div>

      <div className="lower">
        <Silhouette closeness={closeness * 0.7} place="lower" />
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
