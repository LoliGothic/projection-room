import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import { CUTSCENE } from '../../config/tuning'
import { RESET_NOTICE } from '../../config/feed.data'
import { useTimeout } from '../../hooks/useTimeout'

type Step = 'freeze' | 'loading' | 'notice'

interface Props {
  onDone: () => void
}

/**
 * ミス時の演出：画面が一瞬固まる → 読み込み中 → おすすめリセットの通知。
 * 説明文は出さない。
 *
 * 固まっているあいだは下のフィードが透けるので、
 * いま間違えた動画がそのまま止まって見える。
 */
export function ResetScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>('freeze')

  useEffect(() => {
    const a = window.setTimeout(() => {
      setStep('loading')
      audio.playLoading()
    }, CUTSCENE.freezeMs)
    const b = window.setTimeout(
      () => setStep('notice'),
      CUTSCENE.freezeMs + CUTSCENE.loadingMs,
    )
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])

  useTimeout(onDone, CUTSCENE.freezeMs + CUTSCENE.loadingMs + CUTSCENE.resetNoticeMs)

  return (
    <div className={`resetting ${step}`} role="presentation">
      {step === 'loading' && <span className="spinner" aria-label="読み込み中" />}
      {step === 'notice' && <p className="reset-notice">{RESET_NOTICE}</p>}
    </div>
  )
}
