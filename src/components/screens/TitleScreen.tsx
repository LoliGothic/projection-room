import { Projector } from '../game/Projector'

interface Props {
  onStart: () => void
  onGallery: () => void
  onSettings: () => void
  onCredits: () => void
}

export function TitleScreen({ onStart, onGallery, onSettings, onCredits }: Props) {
  return (
    <div className="title-screen">
      <div className="title-projector">
        <Projector />
      </div>
      <h1 className="title-main">映写室</h1>
      <p className="title-lead">
        本物のフィルムは映写し、
        <br />
        紛れ込んだ偽物は焼き捨てること。
      </p>
      <button type="button" className="title-start" onClick={onStart}>
        上映を始める
      </button>
      <nav className="title-menu">
        <button type="button" className="ghost-button" onClick={onGallery}>
          上映記録
        </button>
        <button type="button" className="ghost-button" onClick={onSettings}>
          設定
        </button>
        <button type="button" className="ghost-button" onClick={onCredits}>
          クレジット
        </button>
      </nav>
    </div>
  )
}
