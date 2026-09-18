import type { Clip } from '../../core/types'

interface Props {
  clips: readonly Clip[]
  onBack: () => void
}

/** clips.json の出典・ライセンスと、使用した音の一覧 */
export function CreditsScreen({ clips, onBack }: Props) {
  const real = clips.filter((c) => !c.isAI)
  const ai = clips.filter((c) => c.isAI)

  // 同じ作品の場面をまとめる
  const works = new Map<string, Clip[]>()
  for (const c of real) {
    const list = works.get(c.work) ?? []
    list.push(c)
    works.set(c.work, list)
  }

  const tools = new Map<string, number>()
  for (const c of ai) {
    const key = c.tool || '不明'
    tools.set(key, (tools.get(key) ?? 0) + 1)
  }

  return (
    <div className="panel">
      <h2 className="panel-title">クレジット</h2>

      <section>
        <h3 className="panel-subtitle">映像（本物）</h3>
        {works.size === 0 && <p className="panel-note">登録がありません。</p>}
        <ul className="credit-list">
          {[...works.entries()].map(([work, list]) => {
            const head = list[0]
            return (
              <li key={work}>
                <p className="credit-title">
                  {head.title ?? work}
                  {head.year ? `（${head.year}）` : ''}
                  {list.length > 1 ? ` ほか ${list.length} 場面` : ''}
                </p>
                {head.director && <p className="credit-sub">監督: {head.director}</p>}
                {head.license && <p className="credit-sub">{head.license}</p>}
                {head.sourceUrl && (
                  <p className="credit-sub">
                    <a href={head.sourceUrl} target="_blank" rel="noreferrer">
                      {head.sourceUrl}
                    </a>
                  </p>
                )}
              </li>
            )
          })}
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
            <p className="credit-title">映写機の回転音・ドローン・息づかい・効果音</p>
            <p className="credit-sub">
              すべて Web Audio API による合成音（外部の音源は使用していません）
            </p>
          </li>
        </ul>
      </section>

      <button type="button" className="title-start" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
