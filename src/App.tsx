import { useCallback, useEffect, useMemo } from 'react'
import { isCorrect, type Verdict } from './core/types'
import { currentClip } from './core/session'
import { audio } from './audio/engine'
import { APP } from './config/app'
import { useGame } from './state/gameStore'
import { useSettings } from './state/settingsStore'
import { endingById } from './config/endings.data'
import { useRecords } from './state/recordsStore'
import { FeedScreen } from './components/screens/FeedScreen'
import { ResetScreen } from './components/screens/ResetScreen'
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

  const onStart = useCallback(() => {
    void audio.unlock()
    send({ type: 'start' })
  }, [send])

  const onAnswer = useCallback(
    (verdict: Verdict) => {
      const clip = session ? currentClip(session) : undefined
      if (clip) {
        const pan = verdict === 'keep' ? 0.6 : -0.6
        if (isCorrect(clip, verdict)) audio.playCorrect(pan)
        else audio.playMiss(pan)
      }
      send({ type: 'answer', verdict })
    },
    [session, send],
  )

  const onReplay = useCallback(() => send({ type: 'replay' }), [send])
  const onDarkness = useCallback(() => send({ type: 'darkness' }), [send])
  const onCutsceneDone = useCallback(() => send({ type: 'cutsceneDone' }), [send])

  // リセット演出のあいだは環境音を止める
  const phaseName = session?.phase.name
  useEffect(() => {
    audio.setAmbienceRunning(phaseName === 'playing')
  }, [phaseName])

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
            <h1 className="launch-name">{APP.name}</h1>
            <p className="launch-tagline">{APP.tagline}</p>
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
