import type { Clip } from '../../core/types'
import { APP } from '../../config/app'

interface Props {
  clips: readonly Clip[]
  onBack: () => void
}

/** clips.json の提供者・出典と、使用した音の一覧 */
export function CreditsScreen({ clips, onBack }: Props) {
  const real = clips.filter((c) => !c.isAI)
  const ai = clips.filter((c) => c.isAI)

  // 同じ提供元をまとめる
  const providers = new Map<string, { source?: string; sourceUrl?: string; count: number }>()
  for (const c of real) {
    const key = c.contributor || '提供者不明'
    const entry = providers.get(key) ?? { source: c.source, sourceUrl: c.sourceUrl, count: 0 }
    entry.count++
    providers.set(key, entry)
  }

  const tools = new Map<string, number>()
  for (const c of ai) {
    const key = c.tool || '生成ツール不明'
    tools.set(key, (tools.get(key) ?? 0) + 1)
  }

  return (
    <div className="panel">
      <h2 className="panel-title">クレジット</h2>
      <p className="panel-note">
        {APP.name} は架空のアプリです。実在のサービスとは関係ありません。
      </p>

      <section>
        <h3 className="panel-subtitle">映像（本物）</h3>
        {providers.size === 0 && <p className="panel-note">登録がありません。</p>}
        <ul className="credit-list">
          {[...providers.entries()].map(([name, info]) => (
            <li key={name}>
              <p className="credit-title">{name}</p>
              <p className="credit-sub">
                {info.source ? `${info.source} / ` : ''}
                {info.count} 本
              </p>
              {info.sourceUrl && (
                <p className="credit-sub">
                  <a href={info.sourceUrl} target="_blank" rel="noreferrer">
                    {info.sourceUrl}
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="panel-subtitle">映像（AI生成）</h3>
        {tools.size === 0 && <p className="panel-note">登録がありません。</p>}
        <ul className="credit-list">
          {[...tools.entries()].map(([tool, count]) => (
            <li key={tool}>
              <p className="credit-title">{tool}</p>
              <p className="credit-sub">{count} 本</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="panel-subtitle">音</h3>
        <ul className="credit-list">
          <li>
            <p className="credit-title">通知音・環境音・効果音</p>
            <p className="credit-sub">
              すべて Web Audio API による合成音（外部の音源は使用していません）
            </p>
          </li>
        </ul>
      </section>

      <button type="button" className="primary-button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
