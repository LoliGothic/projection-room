import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Clip, Verdict } from './core/types'
import { isCorrect } from './core/types'
import { createQueue, fillBuffer, type QueueState } from './core/clipQueue'
import { defaultRng } from './core/rng'
import { loadClips } from './data/loadClips'
import { RULES } from './config/tuning'
import { ClipCard } from './components/game/ClipCard'

interface Deck {
  queue: QueueState
  /** 先頭が現在の 1 本。以降は先読み用 */
  buffer: Clip[]
}

const BUFFER_SIZE = RULES.preloadAhead + 1

function refill(pool: readonly Clip[], deck: Deck): Deck {
  const r = fillBuffer(pool, deck.queue, defaultRng, BUFFER_SIZE, deck.buffer)
  return { queue: r.state, buffer: r.buffer }
}

export default function App() {
  const [pool, setPool] = useState<readonly Clip[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deck, setDeck] = useState<Deck>(() => ({ queue: createQueue(), buffer: [] }))
  const [answered, setAnswered] = useState(0)

  useEffect(() => {
    let alive = true
    loadClips()
      .then((clips) => {
        if (!alive) return
        setPool(clips)
        setDeck((d) => refill(clips, d))
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  const current = deck.buffer[0]

  const onAnswer = useCallback(
    (verdict: Verdict) => {
      if (!pool || !current) return
      // 段階1では正誤を記録するだけ。巻とループは段階2で入れる
      console.debug(isCorrect(current, verdict) ? '正解' : '不正解', current.id)
      setDeck((d) => refill(pool, { ...d, buffer: d.buffer.slice(1) }))
      setAnswered((n) => n + 1)
    },
    [pool, current],
  )

  const preloading = useMemo(() => deck.buffer.slice(1), [deck.buffer])

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

  if (!current) {
    return (
      <div className="theatre">
        <p className="center-message">フィルムを巻いています…</p>
      </div>
    )
  }

  return (
    <div className="theatre">
      <div className="stage">
        <div className="upper">
          <div className="reel-label">第一巻</div>
        </div>

        <ClipCard clip={current} onAnswer={onAnswer} enabled />

        <div className="lower">
          <div className="hint" style={{ opacity: answered >= 6 ? 0.35 : 1 }}>
            <span>← <b>焼き捨てる</b></span>
            <span><b>映写する</b> →</span>
          </div>
        </div>
      </div>

      {/* 先読み。表示はせず、ブラウザにダウンロードだけさせる */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        {preloading.map((c) => (
          <video key={c.id} src={c.src} muted playsInline preload="auto" />
        ))}
      </div>
    </div>
  )
}
