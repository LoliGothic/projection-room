import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import { CUTSCENE } from '../../config/tuning'
import { useTimeout } from '../../hooks/useTimeout'

type Step = 'burn' | 'black' | 'rewind'

interface Props {
  onDone: () => void
}

/**
 * ミス時の演出：映写機が止まって焦げ跡が広がる → 暗転 → 巻き戻し。
 * 説明文は一切出さない。
 */
export function LoopCutScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>('burn')

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
    <div className={`cutscene loopcut ${step}`} role="presentation">
      {step === 'burn' && <span className="scorch" aria-hidden="true" />}
      {step === 'rewind' && <span className="rewind-streaks" aria-hidden="true" />}
    </div>
  )
}
