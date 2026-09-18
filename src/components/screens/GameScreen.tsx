import { useCallback, useEffect, useRef, useState } from 'react'
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
import { CrossingShadow } from '../game/CrossingShadow'
import { useFilmMotion } from '../../hooks/useFilmMotion'

interface Props {
  session: Session
  onAnswer: (verdict: Verdict) => void
  onReplay: () => void
  onDarkness: () => void
  /** 上映をやめてタイトルに戻る */
  onQuit: () => void
  /** ミス演出の最中は操作もタイマーも止める */
  interactive: boolean
}

export function GameScreen({
  session,
  onAnswer,
  onReplay,
  onDarkness,
  onQuit,
  interactive,
}: Props) {
  // 誤タップで進行が消えないよう、2回押させる
  const [quitArmed, setQuitArmed] = useState(false)
  const stage = useRef<VideoStageHandle>(null)
  const gate = useRef<HTMLDivElement>(null)
  const settings = useSettings()
  const clip = currentClip(session)
  const preload = preloadClips(session)
  const { reel, clearedInReel, stats } = session.progress

  // 経過時間は「回答した本数」が変わったときだけリセットする＝リプレイでは戻らない
  const dread = useDreadTimer(interactive, stats.presented, onDarkness)

  const fx = effectiveFx(settings)
  // 映像全体の揺れと明るさのゆらぎ
  useFilmMotion(gate, !settings.reduceFlashing, fx)

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

  // 確認の表示は放っておけば引っ込む
  useEffect(() => {
    if (!quitArmed) return
    const id = window.setTimeout(() => setQuitArmed(false), 3500)
    return () => window.clearTimeout(id)
  }, [quitArmed])

  if (!clip) return <p className="center-message">フィルムを巻いています…</p>

  return (
    <>
      <div className="upper">
        <span className="lamp" style={{ opacity: lamp }} aria-hidden="true" />

        {interactive && (
          <button
            type="button"
            className={quitArmed ? 'quit-link armed' : 'quit-link'}
            onClick={() => (quitArmed ? onQuit() : setQuitArmed(true))}
          >
            {quitArmed ? 'もう一度押すと最初に戻る' : '上映をやめる'}
          </button>
        )}
        <Silhouette closeness={closeness} place="upper" />
        {!settings.reduceFlashing && <CrossingShadow />}
        <Projector speed={projectorSpeed(dread)} stopped={!interactive} onReplay={replay} />
        <div className="reel-label">{reelLabel(reel)}</div>
        {/* 1巻1本のときは常に 0/1 で意味がないので出さない */}
        {RULES.clipsPerReel > 1 && (
          <div className="reel-dots" aria-label={`この巻 ${clearedInReel}/${RULES.clipsPerReel}`}>
            {Array.from({ length: RULES.clipsPerReel }, (_, i) => (
              <span key={i} className={i < clearedInReel ? 'dot on' : 'dot'} />
            ))}
          </div>
        )}
      </div>

      <div className="gate-wrap" ref={gate}>
        <VideoStage
          ref={stage}
          current={clip}
          turn={session.deck.advances}
          preload={preload}
          onAnswer={onAnswer}
          enabled={interactive}
          paused={!interactive}
          fx={fx}
          lightFx={settings.lightFx}
        />
        <DreadOverlay intensity={dread.intensity * fx} />
      </div>

      <div className="lower">
        <Silhouette closeness={closeness * 0.7} place="lower" />
        {!settings.reduceFlashing && <CrossingShadow slow />}
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
