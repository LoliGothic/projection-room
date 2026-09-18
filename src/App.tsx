import { useCallback, useEffect } from 'react'
import { isCorrect, type Verdict } from './core/types'
import { currentClip } from './core/session'
import { audio } from './audio/engine'
import { useGame } from './state/gameStore'
import { useSettings } from './state/settingsStore'
import { GameScreen } from './components/screens/GameScreen'
import { IntertitleScreen } from './components/screens/IntertitleScreen'
import { LoopCutScreen } from './components/screens/LoopCutScreen'
import { TitleScreen } from './components/screens/TitleScreen'

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

  useEffect(() => {
    audio.setVolume(volume)
  }, [volume])
  useEffect(() => {
    audio.setMuted(muted)
  }, [muted])

  const phaseName = session?.phase.name

  // 巻の節目とミス演出のあいだは映写機を止める
  useEffect(() => {
    audio.setProjectorRunning(phaseName === 'playing')
  }, [phaseName])

  const onStart = useCallback(() => {
    void audio.unlock()
    send({ type: 'start' })
  }, [send])

  const onAnswer = useCallback(
    (verdict: Verdict) => {
      const clip = session ? currentClip(session) : undefined
      if (clip) {
        // 右スワイプ＝映写、左スワイプ＝焼却。音も同じ側に振る
        const pan = verdict === 'project' ? 0.65 : -0.65
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
      <div className="theatre">
        <p className="center-message">
          フィルムが見つかりません。
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
      <div className="theatre">
        <p className="center-message">フィルムを巻いています…</p>
      </div>
    )
  }

  const { phase } = session

  return (
    <div className="theatre">
      <div className="stage">
        {phase.name === 'title' && <TitleScreen onStart={onStart} />}

        {phase.name === 'playing' && (
          <GameScreen
            session={session}
            onAnswer={onAnswer}
            onReplay={onReplay}
            onDarkness={onDarkness}
          />
        )}

        {phase.name === 'intertitle' && (
          <IntertitleScreen card={phase.card} reel={phase.reel} onDone={onCutsceneDone} />
        )}

        {phase.name === 'loopCut' && <LoopCutScreen onDone={onCutsceneDone} />}

        {phase.name === 'ending' && (
          <p className="center-message">
            （エンディング: {phase.endingId}）
            <br />
            段階4で実装します
            <br />
            <br />
            <button type="button" className="title-start" onClick={onStart}>
              もう一度
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
