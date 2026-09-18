import { useState } from 'react'
import type { Clip } from '../../core/types'
import type { Mistake, Stats } from '../../core/progress'
import { averageReplays } from '../../core/progress'
import { reelLabel } from '../../config/intertitles.data'

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
          <dt>出題</dt>
          <dd>{stats.presented}</dd>
        </div>
        <div>
          <dt>ループ</dt>
          <dd>{stats.loops}</dd>
        </div>
        <div>
          <dt>焼いた本物</dt>
          <dd>{stats.burnedReal}</dd>
        </div>
        <div>
          <dt>見逃したAI</dt>
          <dd>{stats.missedAI}</dd>
        </div>
        <div>
          <dt>平均リプレイ</dt>
          <dd>{averageReplays(stats).toFixed(1)}</dd>
        </div>
      </dl>

      {mistakes.length === 0 ? (
        <p className="panel-note">一本も取り違えなかった。</p>
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
                controls={false}
                disablePictureInPicture
              />
              <div className="recap-meta">
                <p className="recap-verdict">
                  {reelLabel(mistake.reel)}・
                  {clip.isAI ? 'AI動画を映写してしまった' : '本物を焼き捨てた'}
                </p>
                {clip.isAI ? (
                  <>
                    <p className="recap-line">
                      <span>生成ツール</span>
                      {clip.tool || '不明'}
                    </p>
                    {clip.note && <p className="recap-note">{clip.note}</p>}
                  </>
                ) : (
                  <>
                    <p className="recap-line">
                      <span>作品</span>
                      {clip.title ?? '不明'}
                      {clip.year ? `（${clip.year}）` : ''}
                    </p>
                    {clip.director && (
                      <p className="recap-line">
                        <span>監督</span>
                        {clip.director}
                      </p>
                    )}
                    {clip.sourceUrl && (
                      <p className="recap-line">
                        <span>出典</span>
                        <a href={clip.sourceUrl} target="_blank" rel="noreferrer">
                          {clip.sourceUrl}
                        </a>
                      </p>
                    )}
                    {clip.license && (
                      <p className="recap-line">
                        <span>ライセンス</span>
                        {clip.license}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="panel-note">この動画は見つからなかった。</p>
          )}
        </>
      )}

      <button type="button" className="title-start" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
