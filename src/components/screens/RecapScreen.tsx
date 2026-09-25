import { useState } from 'react'
import type { Clip } from '../../core/types'
import type { Mistake, Stats } from '../../core/progress'
import { averageReplays } from '../../core/progress'

interface Props {
  mistakes: readonly Mistake[]
  clipsById: Map<string, Clip>
  stats: Stats
  onBack: () => void
}

/** そのプレイで間違えた動画を見直す画面 */
export function RecapScreen({ mistakes, clipsById, stats, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const mistake = mistakes[index]
  const clip = mistake ? clipsById.get(mistake.clipId) : undefined

  return (
    <div className="panel">
      <h2 className="panel-title">振り返り</h2>

      <dl className="stat-grid">
        <div>
          <dt>見た本数</dt>
          <dd>{stats.presented}</dd>
        </div>
        <div>
          <dt>リセット</dt>
          <dd>{stats.loops}</dd>
        </div>
        <div>
          <dt>誤って報告</dt>
          <dd>{stats.reportedReal}</dd>
        </div>
        <div>
          <dt>見逃し</dt>
          <dd>{stats.missedAI}</dd>
        </div>
        <div>
          <dt>平均再生</dt>
          <dd>{averageReplays(stats).toFixed(1)}</dd>
        </div>
      </dl>

      {mistakes.length === 0 ? (
        <p className="panel-note">一本も取り違えませんでした。</p>
      ) : (
        <>
          <div className="recap-nav">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              前
            </button>
            <span className="recap-count">
              {index + 1} / {mistakes.length}
            </span>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIndex((i) => Math.min(mistakes.length - 1, i + 1))}
              disabled={index >= mistakes.length - 1}
            >
              次
            </button>
          </div>

          {clip ? (
            <>
              <video
                key={clip.id}
                className="recap-video"
                src={clip.src}
                muted
                playsInline
                autoPlay
                loop
                disablePictureInPicture
              />
              <div className="recap-meta">
                <p className="recap-verdict">
                  {mistake.stage}段階目・
                  {clip.isAI ? 'AI生成を残してしまった' : '本物を報告してしまった'}
                </p>
                <p className="recap-line">
                  <span>カテゴリ</span>
                  {clip.category}
                  {clip.scene ? ` / ${clip.scene}` : ''}
                </p>
                {clip.isAI ? (
                  <>
                    {clip.tool && (
                      <p className="recap-line">
                        <span>生成ツール</span>
                        {clip.tool}
                      </p>
                    )}
                    {clip.note && <p className="recap-note">{clip.note}</p>}
                  </>
                ) : (
                  <>
                    {clip.contributor && (
                      <p className="recap-line">
                        <span>提供</span>
                        {clip.contributor}
                      </p>
                    )}
                    {clip.source && (
                      <p className="recap-line">
                        <span>出典</span>
                        {clip.sourceUrl ? (
                          <a href={clip.sourceUrl} target="_blank" rel="noreferrer">
                            {clip.source}
                          </a>
                        ) : (
                          clip.source
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="panel-note">この動画は見つかりませんでした。</p>
          )}
        </>
      )}

      <button type="button" className="primary-button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
