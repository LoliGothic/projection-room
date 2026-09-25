import { useCallback, useEffect } from 'react'
import { isCorrect, type Verdict } from './core/types'
import { currentClip } from './core/session'
import { audio } from './audio/engine'
import { APP } from './config/app'
import { useGame } from './state/gameStore'
import { useSettings } from './state/settingsStore'
import { FeedScreen } from './components/screens/FeedScreen'

export default function App() {
  const session = useGame((s) => s.session)
  const error = useGame((s) => s.error)
  const load = useGame((s) => s.load)
  const send = useGame((s) => s.send)
  const volume = useSettings((s) => s.volume)
  const muted = useSettings((s) => s.muted)

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
        {phase.name === 'launch' && (
          <div className="launch">
            <h1 className="launch-name">{APP.name}</h1>
            <p className="launch-tagline">{APP.tagline}</p>
            <button type="button" className="primary-button" onClick={onStart}>
              はじめる
            </button>
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

        {phase.name === 'resetting' && (
          <div className="resetting" role="presentation" onPointerDown={onCutsceneDone}>
            <p className="reset-notice">おすすめをリセットしました</p>
          </div>
        )}

        {phase.name === 'ending' && (
          <p className="center-message">
            （エンディング: {phase.endingId}）
            <br />
            段階4で実装します
            <br />
            <br />
            <button type="button" className="primary-button" onClick={onStart}>
              もう一度
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
