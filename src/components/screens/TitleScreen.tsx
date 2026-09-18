import { Projector } from '../game/Projector'

interface Props {
  onStart: () => void
  onGallery: () => void
}

/** タイトル画面。段階5で設定・クレジットへの導線を足す。 */
export function TitleScreen({ onStart, onGallery }: Props) {
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
      </nav>
    </div>
  )
}
