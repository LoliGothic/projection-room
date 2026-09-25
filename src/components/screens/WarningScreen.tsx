interface Props {
  onAccept: () => void
}

/** 初回起動時の注意表示 */
export function WarningScreen({ onAccept }: Props) {
  return (
    <div className="launch">
      <h2 className="panel-title">はじめに</h2>
      <p className="warning-text">
        このゲームには、暗い映像と、
        <br />
        ゆるやかな明るさの変化、
        <br />
        不安をあおる表現が含まれます。
        <br />
        <br />
        強い明滅は使っていませんが、
        <br />
        気になる場合は設定の
        <br />
        「演出を弱める」を入れてください。
        <br />
        <br />
        音が鳴ります。音量にご注意ください。
      </p>
      <button type="button" className="primary-button" onClick={onAccept}>
        了解した
      </button>
    </div>
  )
}
