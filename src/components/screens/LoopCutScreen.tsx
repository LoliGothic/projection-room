import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import { CUTSCENE } from '../../config/tuning'
import { useTimeout } from '../../hooks/useTimeout'
import { useSettings } from '../../state/settingsStore'
import { BurnHole } from '../game/BurnHole'

type Step = 'burn' | 'black' | 'rewind'

interface Props {
  onDone: () => void
}

/**
 * ミス時の演出：映像の中央から焦げ跡が広がって穴が開く → 暗転 → 高速の巻き戻し。
 * 焦げのあいだは下のゲーム画面が透けるので、止まったフィルムが焼けて見える。
 * 説明文は一切出さない。
 */
export function LoopCutScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>('burn')
  const lightFx = useSettings((s) => s.lightFx)
  const reduceFlashing = useSettings((s) => s.reduceFlashing)

  useEffect(() => {
    const a = window.setTimeout(() => setStep('black'), CUTSCENE.burnMs)
    const b = window.setTimeout(() => {
      setStep('rewind')
      audio.playRewind()
    }, CUTSCENE.burnMs + CUTSCENE.blackoutMs)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])

  useTimeout(onDone, CUTSCENE.burnMs + CUTSCENE.blackoutMs + CUTSCENE.rewindMs)

  return (
    <div className={`loopcut ${step}`} role="presentation">
      {step === 'burn' && <BurnHole durationMs={CUTSCENE.burnMs} light={lightFx} dim={reduceFlashing} />}
      {step === 'rewind' && (
        <>
          <span className="rewind-streaks" aria-hidden="true" />
          <span className="rewind-frames" aria-hidden="true" />
        </>
      )}
    </div>
  )
}
