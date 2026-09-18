import { useCallback, useEffect } from 'react'
import type { Verdict } from './core/types'
import { useGame } from './state/gameStore'
import { GameScreen } from './components/screens/GameScreen'
import { IntertitleScreen } from './components/screens/IntertitleScreen'
import { LoopCutScreen } from './components/screens/LoopCutScreen'
import { TitleScreen } from './components/screens/TitleScreen'

export default function App() {
  const session = useGame((s) => s.session)
  const error = useGame((s) => s.error)
  const load = useGame((s) => s.load)
  const send = useGame((s) => s.send)

  useEffect(() => {
    void load()
  }, [load])

  const onAnswer = useCallback((verdict: Verdict) => send({ type: 'answer', verdict }), [send])
  const onReplay = useCallback(() => send({ type: 'replay' }), [send])
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
        {phase.name === 'title' && <TitleScreen onStart={() => send({ type: 'start' })} />}

        {phase.name === 'playing' && (
          <GameScreen session={session} onAnswer={onAnswer} onReplay={onReplay} />
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
            <button type="button" className="title-start" onClick={() => send({ type: 'start' })}>
              もう一度
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
