import { audio } from '../../audio/engine'
import { useSettings } from '../../state/settingsStore'

interface Props {
  onBack: () => void
}

export function SettingsScreen({ onBack }: Props) {
  const s = useSettings()

  return (
    <div className="panel">
      <h2 className="panel-title">設定</h2>

      <div className="setting-row">
        <label htmlFor="volume">音量</label>
        <input
          id="volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(s.volume * 100)}
          onChange={(e) => s.set({ volume: Number(e.target.value) / 100 })}
        />
        <span className="setting-value">{Math.round(s.volume * 100)}</span>
      </div>

      <div className="setting-row">
        <label htmlFor="muted">ミュート</label>
        <input
          id="muted"
          type="checkbox"
          checked={s.muted}
          onChange={(e) => s.set({ muted: e.target.checked })}
        />
      </div>

      <div className="setting-row">
        <label htmlFor="fx">演出の強さ</label>
        <input
          id="fx"
          type="range"
          min={0}
          max={100}
          value={Math.round(s.fxIntensity * 100)}
          onChange={(e) => s.set({ fxIntensity: Number(e.target.value) / 100 })}
        />
        <span className="setting-value">{Math.round(s.fxIntensity * 100)}</span>
      </div>

      <div className="setting-row">
        <label htmlFor="reduce">演出を弱める</label>
        <input
          id="reduce"
          type="checkbox"
          checked={s.reduceFlashing}
          onChange={(e) => s.set({ reduceFlashing: e.target.checked })}
        />
      </div>
      <p className="panel-note">
        画面の揺れ・明るさの変化・通知の連続表示をまとめて弱めます。
        不穏タイマー自体は止まりません。
      </p>

      <button
        type="button"
        className="ghost-button"
        onClick={() => {
          void audio.unlock()
          audio.playNotify()
        }}
      >
        音を試す
      </button>

      <button type="button" className="primary-button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
