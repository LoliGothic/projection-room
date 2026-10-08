import { useCallback, useEffect, useMemo } from 'react'
import { isCorrect, type Verdict } from './core/types'
import { currentClip } from './core/session'
import { audio } from './audio/engine'
import { clearSeenFrames } from './state/seenFrames'
import { APP } from './config/app'
import { useGame } from './state/gameStore'
import { useSettings } from './state/settingsStore'
import { endingById } from './config/endings.data'
import { useRecords } from './state/recordsStore'
import { FeedScreen } from './components/screens/FeedScreen'
import { ResetScreen } from './components/screens/ResetScreen'
import { Backdrop } from './components/Backdrop'
import { EndingScreen } from './components/screens/EndingScreen'
import { RecapScreen } from './components/screens/RecapScreen'
import { GalleryScreen } from './components/screens/GalleryScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { CreditsScreen } from './components/screens/CreditsScreen'
import { WarningScreen } from './components/screens/WarningScreen'

export default function App() {
  const session = useGame((s) => s.session)
  const error = useGame((s) => s.error)
  const load = useGame((s) => s.load)
  const send = useGame((s) => s.send)
  const goto = useGame((s) => s.goto)
  const finishRun = useRecords((s) => s.finishRun)
  const volume = useSettings((s) => s.volume)
  const muted = useSettings((s) => s.muted)
  const warningSeen = useSettings((s) => s.warningSeen)
  const setSettings = useSettings((s) => s.set)

  useEffect(() => {
    void load()
    // 音は操作がないと鳴らせないが、取ってくるのは先にできる。
    // 「はじめる」を押してから読み始めると、1本目だけ動画とループがずれる
    void audio.prefetch()
  }, [load])

  // ホームボタンやタブ切り替えで画面を離れたら、音と映像を止める
  useEffect(() => {
    const onVisibility = () => {
      void audio.setHidden(document.hidden)
      if (document.hidden) {
        for (const v of document.querySelectorAll('video')) v.pause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onVisibility)
    }
  }, [])

  useEffect(() => {
    audio.setVolume(volume)
  }, [volume])
  useEffect(() => {
    audio.setMuted(muted)
  }, [muted])

  /*
    音楽はフィードの中だけのもの。
    起動画面やエンディングまで曲が続くと、ゲームが終わったのか分からない。
    ミス演出のあいだは曲を断ち切って砂嵐に差し替える。画面だけが壊れて
    音楽がそのまま流れていると、映像だけの演出に見えてしまう。
  */
  const phaseName = session?.phase.name
  useEffect(() => {
    audio.setScene(
      phaseName === 'playing' ? 'feed' : phaseName === 'resetting' ? 'static' : 'off',
    )
  }, [phaseName])

  const onStart = useCallback(() => {
    void audio.unlock()
    // 前回の巻き戻し用のコマは捨てる。持ち越すと前の回の投稿までさかのぼってしまう
    clearSeenFrames()
    send({ type: 'start' })
  }, [send])

  const onAnswer = useCallback(
    (verdict: Verdict) => {
      const clip = session ? currentClip(session) : undefined
      if (clip) {
        const pan = verdict === 'keep' ? 0.6 : -0.6
        if (isCorrect(clip, verdict)) audio.playCorrect(pan)
        // 間違えたら、いま流れていた曲がその場で逆再生される
        else if (!audio.playReverse()) audio.playMiss(pan)
      }
      send({ type: 'answer', verdict })
    },
    [session, send],
  )

  const onReplay = useCallback(() => send({ type: 'replay' }), [send])
  const onDarkness = useCallback(() => send({ type: 'darkness' }), [send])
  const onCutsceneDone = useCallback(() => {
    // 一本目まで戻したので、さかのぼる先も無くなる
    clearSeenFrames()
    send({ type: 'cutsceneDone' })
  }, [send])

  // エンディングに到達したら記録する
  const endingId = session?.phase.name === 'ending' ? session.phase.endingId : null
  const stats = session?.progress.stats
  useEffect(() => {
    if (!endingId || !stats) return
    finishRun(endingId, stats, endingById(endingId)?.trigger === 'escape')
    // エンディングに入った瞬間の 1 回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endingId])

  const clipsById = useMemo(() => {
    const m = new Map<string, import('./core/types').Clip>()
    for (const c of session?.pool ?? []) m.set(c.id, c)
    return m
  }, [session?.pool])

  const toHome = useCallback(() => goto({ name: 'launch' }), [goto])

  if (error) {
    return (
      <div className="app">
        <p className="center-message">
          動画を読み込めませんでした。
          <br />
          {error}
          <br />
          <br />
          <code style={{ fontSize: '0.8em' }}>npm run gen:dummy</code>
        </p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app">
        <p className="center-message">読み込み中…</p>
      </div>
    )
  }

  const { phase } = session

  return (
    <div className="app">
      <div className="phone">
        {phase.name === 'launch' && !warningSeen && (
          <WarningScreen onAccept={() => setSettings({ warningSeen: true })} />
        )}

        {phase.name === 'launch' && warningSeen && (
          <div className="launch">
            <Backdrop src={APP.backdrop} />
            <h1 className="launch-name">{APP.name}</h1>
            <p className="launch-tagline">{APP.tagline}</p>

            {/*
              遊び方はここにだけ書く。映像の上に操作説明を重ねると、
              実在のアプリに見せかける狙いが崩れる。
              この手のゲームの大枠は知られている前提で、一行に留める。
            */}
            <p className="launch-rule">AIが生成した動画を報告してください</p>

            <button type="button" className="primary-button" onClick={onStart}>
              はじめる
            </button>
            <nav className="launch-menu">
              <button
                type="button"
                className="ghost-button"
                onClick={() => goto({ name: 'gallery' })}
              >
                記録
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => goto({ name: 'settings' })}
              >
                設定
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => goto({ name: 'credits' })}
              >
                クレジット
              </button>
            </nav>
          </div>
        )}

        {(phase.name === 'playing' || phase.name === 'resetting') && (
          <FeedScreen
            session={session}
            onAnswer={onAnswer}
            onReplay={onReplay}
            onDarkness={onDarkness}
            onQuit={toHome}
            interactive={phase.name === 'playing'}
          />
        )}

        {phase.name === 'resetting' && <ResetScreen onDone={onCutsceneDone} />}

        {phase.name === 'ending' && (
          <EndingScreen
            endingId={phase.endingId}
            clip={
              endingById(phase.endingId)?.clipId
                ? clipsById.get(endingById(phase.endingId)!.clipId!)
                : undefined
            }
            numbers={
              stats && {
                presented: stats.presented,
                replays: stats.replays,
                loops: stats.loops,
                correct: stats.correct,
              }
            }
            onRecap={() => goto({ name: 'recap' })}
            onHome={toHome}
          />
        )}

        {phase.name === 'recap' && (
          <RecapScreen
            mistakes={session.progress.stats.mistakes}
            clipsById={clipsById}
            stats={session.progress.stats}
            onBack={toHome}
          />
        )}

        {phase.name === 'gallery' && <GalleryScreen onBack={toHome} />}

        {phase.name === 'settings' && <SettingsScreen onBack={toHome} />}

        {phase.name === 'credits' && <CreditsScreen clips={session.pool} onBack={toHome} />}
      </div>
    </div>
  )
}
