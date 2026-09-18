import { useState } from 'react'
import { ENDINGS } from '../../config/endings.data'
import { useRecords } from '../../state/recordsStore'

interface Props {
  onBack: () => void
}

/** 見たエンディングの一覧。未達成は ？？？ とヒントだけ出す。 */
export function GalleryScreen({ onBack }: Props) {
  const records = useRecords((s) => s.records)
  const saveFailed = useRecords((s) => s.saveFailed)
  const exportCode = useRecords((s) => s.exportCode)
  const importCode = useRecords((s) => s.importCode)

  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const seen = new Set(records.seenEndings)

  return (
    <div className="panel">
      <h2 className="panel-title">上映記録</h2>

      <dl className="stat-grid">
        <div>
          <dt>上映回数</dt>
          <dd>{records.plays}</dd>
        </div>
        <div>
          <dt>脱出</dt>
          <dd>{records.escapes}</dd>
        </div>
        <div>
          <dt>最少ループ</dt>
          <dd>{records.bestLoops === null ? '—' : records.bestLoops}</dd>
        </div>
        <div>
          <dt>エンディング</dt>
          <dd>
            {seen.size} / {ENDINGS.length}
          </dd>
        </div>
      </dl>

      <ul className="ending-list">
        {ENDINGS.map((e) => {
          const found = seen.has(e.id)
          return (
            <li key={e.id} className={found ? 'ending-row found' : 'ending-row'}>
              <span className="ending-name">{found ? e.title : '？？？'}</span>
              <span className="ending-hint">{found ? e.cards[e.cards.length - 1] : e.hint}</span>
            </li>
          )
        })}
      </ul>

      <div className="save-block">
        <h3 className="panel-subtitle">セーブコード</h3>
        <p className="panel-note">
          この文字列を控えておくと、別の端末やデータを消したあとでも記録を戻せます。
        </p>
        <code className="save-code">{exportCode()}</code>
        <div className="save-row">
          <input
            className="save-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="コードを貼り付け"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              const r = importCode(code)
              setMessage(r.ok ? '記録を読み込みました。' : (r.reason ?? '読み込めませんでした。'))
            }}
          >
            読み込む
          </button>
        </div>
        {message && <p className="panel-note">{message}</p>}
        {saveFailed && (
          <p className="panel-note">
            この環境では記録を保存できません。セーブコードを控えてください。
          </p>
        )}
      </div>

      <button type="button" className="title-start" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
