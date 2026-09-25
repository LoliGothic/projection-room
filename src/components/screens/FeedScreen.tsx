import { useCallback, useRef } from 'react'
import type { Verdict } from '../../core/types'
import { currentClip, preloadClips, type Session } from '../../core/session'
import { RULES } from '../../config/tuning'
import { stageLabel } from '../../config/feed.data'
import { FeedVideo, type FeedVideoHandle } from '../game/FeedVideo'

interface Props {
  session: Session
  onAnswer: (verdict: Verdict) => void
  onReplay: () => void
  onDarkness: () => void
  /** 演出中は操作もタイマーも止める */
  interactive: boolean
}

export function FeedScreen({ session, onAnswer, onReplay, interactive }: Props) {
  const video = useRef<FeedVideoHandle>(null)
  const clip = currentClip(session)
  const preload = preloadClips(session)
  const { stage, stats } = session.progress

  const replay = useCallback(() => {
    video.current?.replay()
    onReplay()
  }, [onReplay])

  if (!clip) return <p className="center-message">読み込み中…</p>

  return (
    <>
      <FeedVideo
        ref={video}
        current={clip}
        turn={session.deck.advances}
        preload={preload}
        onAnswer={onAnswer}
        enabled={interactive}
        paused={!interactive}
      />

      <div className="feed-overlay">
        <div className="progress-bars" aria-label={`段階 ${stageLabel(stage)}`}>
          {Array.from({ length: RULES.totalStages }, (_, i) => (
            <span key={i} className={i < stage - 1 ? 'bar done' : i === stage - 1 ? 'bar now' : 'bar'} />
          ))}
        </div>

        <div className="side-actions">
          <button type="button" className="side-button" onClick={replay} aria-label="もう一度再生">
            ↻
          </button>
        </div>

        <div className="feed-bottom">
          <p className="account">@{clip.contributor ?? 'unknown'}</p>
          <p className="caption">{clip.scene ?? ''}</p>
          <div className="hint" style={{ opacity: stats.presented >= 6 ? 0.3 : 1 }}>
            <span>← 報告する</span>
            <span>残す →</span>
          </div>
        </div>
      </div>
    </>
  )
}
