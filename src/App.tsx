import { useCallback, useEffect, useMemo } from 'react'
import { isCorrect, type Verdict } from './core/types'
import { currentClip } from './core/session'
import { endingById } from './config/endings.data'
import { audio } from './audio/engine'
import { useGame } from './state/gameStore'
import { useRecords } from './state/recordsStore'
import { useSettings } from './state/settingsStore'
import { EndingScreen } from './components/screens/EndingScreen'
import { GalleryScreen } from './components/screens/GalleryScreen'
import { GameScreen } from './components/screens/GameScreen'
import { IntertitleScreen } from './components/screens/IntertitleScreen'
import { LoopCutScreen } from './components/screens/LoopCutScreen'
import { RecapScreen } from './components/screens/RecapScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { CreditsScreen } from './components/screens/CreditsScreen'
import { TitleScreen } from './components/screens/TitleScreen'
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

  useEffect(() => {
    audio.setVolume(volume)
  }, [volume])
  useEffect(() => {
    audio.setMuted(muted)
  }, [muted])

  const phase = session?.phase
  const phaseName = phase?.name

  // 巻の節目とミス演出のあいだは映写機を止める
  useEffect(() => {
    audio.setProjectorRunning(phaseName === 'playing')
  }, [phaseName])

  // エンディングに到達したら記録する
  const endingId = phase?.name === 'ending' ? phase.endingId : null
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
  const toTitle = useCallback(() => goto({ name: 'title' }), [goto])

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

  if (!session || !phase) {
    return (
      <div className="theatre">
        <p className="center-message">フィルムを巻いています…</p>
      </div>
    )
  }

  return (
    <div className="theatre">
      <div className="stage">
        {phase.name === 'title' && !warningSeen && (
          <WarningScreen onAccept={() => setSettings({ warningSeen: true })} />
        )}

        {phase.name === 'title' && warningSeen && (
          <TitleScreen
            onStart={onStart}
            onGallery={() => goto({ name: 'gallery' })}
            onSettings={() => goto({ name: 'settings' })}
            onCredits={() => goto({ name: 'credits' })}
          />
        )}

        {/* ミス演出のあいだもゲーム画面は残す。止まったフィルムの上で焦げが広がる */}
        {(phase.name === 'playing' || phase.name === 'loopCut') && (
          <GameScreen
            session={session}
            onAnswer={onAnswer}
            onReplay={onReplay}
            onDarkness={onDarkness}
            onQuit={toTitle}
            interactive={phase.name === 'playing'}
          />
        )}

        {phase.name === 'intertitle' && (
          <IntertitleScreen card={phase.card} reel={phase.reel} onDone={onCutsceneDone} />
        )}

        {phase.name === 'loopCut' && <LoopCutScreen onDone={onCutsceneDone} />}

        {phase.name === 'ending' && (
          <EndingScreen
            endingId={phase.endingId}
            clip={
              endingById(phase.endingId)?.clipId
                ? clipsById.get(endingById(phase.endingId)!.clipId!)
                : undefined
            }
            onRecap={() => goto({ name: 'recap' })}
            onTitle={toTitle}
          />
        )}

        {phase.name === 'recap' && (
          <RecapScreen
            mistakes={session.progress.stats.mistakes}
            clipsById={clipsById}
            stats={session.progress.stats}
            onBack={toTitle}
          />
        )}

        {phase.name === 'gallery' && <GalleryScreen onBack={toTitle} />}

        {phase.name === 'settings' && <SettingsScreen onBack={toTitle} />}

        {phase.name === 'credits' && <CreditsScreen clips={session.pool} onBack={toTitle} />}
      </div>
    </div>
  )
}
