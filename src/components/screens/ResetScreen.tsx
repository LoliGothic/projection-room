import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import { CUTSCENE } from '../../config/tuning'
import { RESET_NOTICE } from '../../config/feed.data'
import { useTimeout } from '../../hooks/useTimeout'
import { useSettings } from '../../state/settingsStore'
import { GlitchOverlay } from '../game/GlitchOverlay'

type Step = 'freeze' | 'glitch' | 'notice'

interface Props {
  onDone: () => void
}

/**
 * ミス時の演出：画面が一瞬固まる → 画面が壊れる → おすすめリセットの通知。
 * 説明文は出さない。
 *
 * 固まっているあいだは下のフィードが透けるので、
 * いま間違えた動画がそのまま止まって見える。
 *
 * 「読み込み中」のぐるぐるにしていたが、通信が遅いだけに見えてしまうため、
 * フィードそのものが壊れる見せ方に変えた。
 */
export function ResetScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>('freeze')
  const softened = useSettings((s) => s.reduceFlashing)

  useEffect(() => {
    const a = window.setTimeout(() => {
      setStep('glitch')
      audio.playGlitch()
    }, CUTSCENE.freezeMs)
    const b = window.setTimeout(
      () => setStep('notice'),
      CUTSCENE.freezeMs + CUTSCENE.glitchMs,
    )
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])

  useTimeout(onDone, CUTSCENE.freezeMs + CUTSCENE.glitchMs + CUTSCENE.resetNoticeMs)

  return (
    <div className={`resetting ${step}`} role="presentation">
      {step === 'glitch' && <GlitchOverlay durationMs={CUTSCENE.glitchMs} softened={softened} />}
      {step === 'notice' && <p className="reset-notice">{RESET_NOTICE}</p>}
    </div>
  )
}
