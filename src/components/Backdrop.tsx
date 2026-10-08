import type { CSSProperties } from 'react'

interface Props {
  /** public/ からの相対パス */
  src: string
  /** 浮かび上がりきるまで（ms） */
  fadeMs?: number
}

/**
 * 画面の奥に敷く絵。暗く沈めて、文字の邪魔をしない濃さまでしか上げない。
 *
 * 画像が置かれていなければ何も出ない（背景の読み込み失敗は黙って無視される）。
 * 絵が無くても成り立つ画面にしておき、あとから差し込めるようにするため。
 */
export function Backdrop({ src, fadeMs = 2400 }: Props) {
  const url = import.meta.env.BASE_URL + src.replace(/^\.?\//, '')
  const style = {
    backgroundImage: `url("${url}")`,
    animationDuration: `${fadeMs}ms`,
  } as CSSProperties
  return <div className="backdrop" style={style} aria-hidden="true" />
}
