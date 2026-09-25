import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Verdict } from '../../core/types'
import { currentClip, preloadClips, type Session } from '../../core/session'
import {
  ambienceLevel,
  counterDrift,
  screenBrightness,
  type Dread,
} from '../../core/dread'
import { baseCounters, driftedCounters } from '../../core/counters'
import { accountNameFor, captionFor, stageLabel } from '../../config/feed.data'
import { DREAD, FX, RULES } from '../../config/tuning'
import { audio } from '../../audio/engine'
import { useDreadTimer } from '../../hooks/useDreadTimer'
import { useDreadNotices } from '../../hooks/useDreadEffects'
import { effectiveFx, useSettings } from '../../state/settingsStore'
import { FeedVideo, type FeedVideoHandle } from '../game/FeedVideo'
import { SideActions } from '../game/SideActions'
import { Notifications } from '../game/Notifications'

interface Props {
  session: Session
  onAnswer: (verdict: Verdict) => void
  onReplay: () => void
  onDarkness: () => void
  /** フィードを閉じて起動画面に戻る */
  onQuit: () => void
  /** 演出中は操作もタイマーも止める */
  interactive: boolean
}

/** 経過秒。数字は出さないが、飾りの数字を動かすのに使う */
function elapsedSecOf(d: Dread): number {
  const thresholds = DREAD.stagesMs
  const from = d.stage === 0 ? 0 : thresholds[d.stage - 1]
  const to = thresholds[Math.min(d.stage, thresholds.length - 1)]
  return (from + (to - from) * d.progress) / 1000
}

export function FeedScreen({
  session,
  onAnswer,
  onReplay,
  onDarkness,
  onQuit,
  interactive,
}: Props) {
  // 誤タップで進行が消えないよう、2回押させる
  const [quitArmed, setQuitArmed] = useState(false)
  const video = useRef<FeedVideoHandle>(null)
  const settings = useSettings()
  const clip = currentClip(session)
  const preload = preloadClips(session)
  const { stage, stats } = session.progress
  const turn = session.deck.advances

  // 経過時間は「デッキを進めた回数」が変わったときだけリセットする＝リプレイでは戻らない
  const dread = useDreadTimer(interactive, turn, onDarkness)
  const fx = effectiveFx(settings)
  const softened = settings.reduceFlashing

  const notices = useDreadNotices(dread, interactive, softened, turn)

  // 音は外部システムなので効果として同期する
  useEffect(() => {
    audio.setDread(dread.intensity * fx, ambienceLevel(dread) * fx)
  }, [dread, fx])
  useEffect(() => {
    audio.setLoops(stats.loops)
  }, [stats.loops])

  // 通知が増えたら鳴らす
  const noticeCount = notices.length
  useEffect(() => {
    if (noticeCount > 0) audio.playNotify()
  }, [noticeCount])

  // 画面がゆっくり暗くなる
  useEffect(() => {
    const el = document.querySelector('.phone') as HTMLElement | null
    if (!el) return
    const floor = 1 - (1 - FX.minBrightness) * fx
    el.style.setProperty('--screen-brightness', screenBrightness(dread, floor).toFixed(3))
    return () => el.style.setProperty('--screen-brightness', '1')
  }, [dread, fx])

  const counters = useMemo(() => {
    if (!clip) return { likes: 0, comments: 0, shares: 0 }
    return driftedCounters(
      baseCounters(clip.id),
      elapsedSecOf(dread),
      counterDrift(dread) * fx,
      FX.counterDriftPerSec,
    )
  }, [clip, dread, fx])

  const replay = useCallback(() => {
    video.current?.replay()
    onReplay()
  }, [onReplay])

  const onDecorative = useCallback(() => audio.playTap(), [])

  // 確認の表示は放っておけば引っ込む
  useEffect(() => {
    if (!quitArmed) return
    const id = window.setTimeout(() => setQuitArmed(false), 3500)
    return () => window.clearTimeout(id)
  }, [quitArmed])

  // 動画が取れなかったときに黙って黒くならないようにする
  const [failed, setFailed] = useState<string | null>(null)
  const onVideoError = useCallback(() => setFailed(clip?.src ?? null), [clip?.src])

  if (!clip) return <p className="center-message">読み込み中…</p>

  return (
    <>
      <FeedVideo
        ref={video}
        current={clip}
        turn={turn}
        preload={preload}
        onAnswer={onAnswer}
        enabled={interactive}
        paused={!interactive}
        onTap={replay}
        onVideoError={onVideoError}
      />

      {failed && (
        <p className="video-error">
          動画を読み込めませんでした。
          <br />
          <code>{failed}</code>
        </p>
      )}

      <div className="feed-overlay">
        <div className="feed-top">
          <div className="top-row">
            {/*
              画面上端いっぱいのセグメントバーにすると、実在のアプリの
              ストーリーズに見えてしまい、タップで進むと誤解される。
              小さなゲージとテキストに留める。
            */}
            <div
              className="stage-gauge"
              style={{ ['--gauge' as string]: `${(stage / RULES.totalStages) * 360}deg` }}
              aria-label={`${stageLabel(stage)} 段階目`}
            >
              <span className="stage-gauge-ring" aria-hidden="true" />
              <span className="stage-gauge-text">{stageLabel(stage)}</span>
            </div>

            <button
              type="button"
              className={quitArmed ? 'quit-link armed' : 'quit-link'}
              onClick={() => (quitArmed ? onQuit() : setQuitArmed(true))}
            >
              {quitArmed ? 'もう一度押すとやめる' : 'やめる'}
            </button>
          </div>
          <Notifications notices={notices} />
        </div>

        <SideActions counters={counters} onReplay={replay} onDecorative={onDecorative} />

        <div className="feed-bottom">
          <p className="account">@{accountNameFor(clip.contributor, stats.loops, turn, clip.id)}</p>
          <p className="caption">{captionFor(stats.loops, turn)}</p>
          <div className="hint" style={{ opacity: stats.presented >= 6 ? 0.3 : 1 }}>
            <span>← 報告する</span>
            <span>残す →</span>
          </div>
        </div>
      </div>
    </>
  )
}
