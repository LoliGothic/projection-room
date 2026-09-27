import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Verdict } from '../../core/types'
import { currentClip, preloadClips, previousClip, type Session } from '../../core/session'
import {
  counterDrift,
  screenBrightness,
  type Dread,
} from '../../core/dread'
import { baseCounters, driftedCounters } from '../../core/counters'
import { accountNameFor, captionFor, stageLabel } from '../../config/feed.data'
import { APP } from '../../config/app'
import { DREAD, FX, RULES } from '../../config/tuning'
import { audio } from '../../audio/engine'
import { useDreadTimer } from '../../hooks/useDreadTimer'
import { useDreadNotices } from '../../hooks/useDreadEffects'
import { effectiveFx, useSettings } from '../../state/settingsStore'
import { pushSeenFrame } from '../../state/seenFrames'
import { FeedVideo, type FeedVideoHandle } from '../game/FeedVideo'
import { SideActions } from '../game/SideActions'
import { Notifications } from '../game/Notifications'
import { CommentSheet } from '../game/CommentSheet'
import { ReportSheet } from '../game/ReportSheet'

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
  const previous = previousClip(session)
  const { stage, stats } = session.progress
  const turn = session.deck.advances

  // 経過時間は「デッキを進めた回数」が変わったときだけリセットする＝リプレイでは戻らない
  const dread = useDreadTimer(interactive, turn, onDarkness)
  const fx = effectiveFx(settings)
  const softened = settings.reduceFlashing

  const notices = useDreadNotices(dread, interactive, softened, turn)

  // 音は外部システムなので効果として同期する
  useEffect(() => {
    audio.setDread(dread.intensity * fx)
  }, [dread, fx])
  // 投稿が変わるたびに BGM も変える
  useEffect(() => {
    audio.setTurn(turn)
  }, [turn])

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

  /**
   * 答える。巻き戻しで使うので、送る前にいまのコマを控えておく。
   * 送ったあとでは、もう次の動画に変わっている。
   */
  const answer = useCallback(
    (verdict: Verdict) => {
      pushSeenFrame(video.current?.snapshot() ?? null)
      onAnswer(verdict)
    },
    [onAnswer],
  )

  const replay = useCallback(() => {
    video.current?.replay()
    // 映像を頭に戻すので、音楽も同じところへ戻す
    audio.restartLoop()
    onReplay()
  }, [onReplay])

  const onDecorative = useCallback(() => audio.playTap(), [])

  // シートを開いているあいだは送りの操作を止める
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const sheetOpen = commentsOpen || reportOpen

  const openComments = useCallback(() => {
    audio.playTap()
    setCommentsOpen(true)
  }, [])
  const openReport = useCallback(() => {
    audio.playTap()
    setReportOpen(true)
  }, [])

  /** 共有。外部サイトを新しいタブで開くだけで、こちらからは何も送らない */
  const share = useCallback(() => {
    audio.playTap()
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(APP.shareText)
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer',
    )
  }, [])

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
        previous={previous}
        turn={turn}
        preload={preload}
        enabled={interactive && !sheetOpen}
        paused={!interactive}
        onAdvance={() => answer('keep')}
        onTap={replay}
        onVideoError={onVideoError}
        renderOverlay={(postClip, isCurrent, offset) => (
          <div className="post-overlay">
            <SideActions
              // 動画が変わったらメニューやハートの状態を持ち越さない
              key={postClip.id}
              counters={isCurrent ? counters : baseCounters(postClip.id)}
              onReport={openReport}
              onComments={openComments}
              onShare={share}
              onDecorative={onDecorative}
              enabled={isCurrent && interactive && !sheetOpen}
            />
            <div className="feed-bottom">
              <p className="account">
                @{accountNameFor(postClip.contributor, stats.loops, turn + offset, postClip.id)}
              </p>
              <p className="caption">{captionFor(stats.loops, turn + offset)}</p>
            </div>
          </div>
        )}
      />

      {failed && (
        <p className="video-error">
          動画を読み込めませんでした。
          <br />
          <code>{failed}</code>
        </p>
      )}

      <div className="app-chrome">
        <div className="feed-top">
          <div className="top-row">
            {/*
              フィードを抜けてホームに戻る操作。投稿ごとのボタンとは別に置く。
              あちらは投稿に対する操作で、送ると流れていってしまうため。
            */}
            <button
              type="button"
              className={quitArmed ? 'quit-link armed' : 'quit-link'}
              onClick={() => (quitArmed ? onQuit() : setQuitArmed(true))}
            >
              {quitArmed ? 'もう一度押すとやめる' : 'やめる'}
            </button>

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
          </div>
          <Notifications notices={notices} />
        </div>

        {commentsOpen && (
          <CommentSheet
            clipId={clip.id}
            loops={stats.loops}
            total={counters.comments}
            onClose={() => setCommentsOpen(false)}
          />
        )}

        {reportOpen && (
          <ReportSheet
            onJudge={() => {
              setReportOpen(false)
              answer('report')
            }}
            onClose={() => setReportOpen(false)}
          />
        )}

      </div>
    </>
  )
}
