import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import { CUTSCENE } from '../../config/tuning'
import { RESET_NOTICE } from '../../config/feed.data'
import { useTimeout } from '../../hooks/useTimeout'
import { useSettings } from '../../state/settingsStore'
import { RewindOverlay } from '../game/RewindOverlay'

type Step = 'freeze' | 'rewind' | 'notice'

interface Props {
  onDone: () => void
}

/**
 * ミス時の演出：画面が一瞬固まる → フィードが巻き戻る → おすすめリセットの通知。
 * 説明文は出さない。
 *
 * 固まっているあいだは下のフィードが透けるので、
 * いま間違えた動画がそのまま止まって見える。
 *
 * はじめは「読み込み中」のぐるぐるにしていたが、通信が遅いだけに見えてしまう。
 * 次に画面が壊れる砂嵐にしたが、これはテレビの壊れ方で、アプリの壊れ方ではない。
 * 送ってきた投稿を逆にさかのぼって一本目に戻る、いまの形に落ち着いた。
 * 「戻された」ことが一目で伝わり、フィードという作りからも外れない。
 */
export function ResetScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>('freeze')
  const softened = useSettings((s) => s.reduceFlashing)

  useEffect(() => {
    const a = window.setTimeout(() => {
      setStep('rewind')
      audio.playGlitch()
    }, CUTSCENE.freezeMs)
    const b = window.setTimeout(
      () => setStep('notice'),
      CUTSCENE.freezeMs + CUTSCENE.rewindMs,
    )
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])

  useTimeout(onDone, CUTSCENE.freezeMs + CUTSCENE.rewindMs + CUTSCENE.resetNoticeMs)

  return (
    <div className={`resetting ${step}`} role="presentation">
      {step === 'rewind' && <RewindOverlay durationMs={CUTSCENE.rewindMs} softened={softened} />}
      {step === 'notice' && <p className="reset-notice">{RESET_NOTICE}</p>}
    </div>
  )
}
