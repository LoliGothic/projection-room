/**
 * これまで送ってきた投稿のコマ。
 *
 * 間違えたときに、送ってきた投稿を逆にさかのぼって見せるために使う。
 * そこで動画を読み直していては間に合わないので、送るたびに小さな写しを
 * 取っておき、巻き戻しはその静止画を並べて動かすだけにしてある。
 *
 * 遊びの状態ではなく画面の見た目のための控えなので、core には置かない。
 */

/** 一周は8本なので、そのぶん取れれば足りる */
const MAX = 12

let frames: string[] = []

export function pushSeenFrame(dataUrl: string | null): void {
  if (!dataUrl) return
  frames.push(dataUrl)
  if (frames.length > MAX) frames = frames.slice(-MAX)
}

/** 古い順。末尾がいちばん最後に見ていた投稿 */
export function seenFrames(): readonly string[] {
  return frames
}

export function clearSeenFrames(): void {
  frames = []
}
