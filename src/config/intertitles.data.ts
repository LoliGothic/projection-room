/**
 * 無声映画風の字幕カード。文言はここだけ触れば差し替えられる。
 * 巻の節目と、ミスで第1巻に戻されたときに出る。
 */

export interface Intertitle {
  /** 大きく出す一文 */
  main: string
  /** ループを重ねたときにだけ足される一文 */
  sub?: string
}

/** 第1巻〜第8巻の字幕カード */
export const REEL_CARDS: readonly string[] = [
  '扉は、内側からしか閉まらない。',
  '客席は満員だと、支配人は言った。',
  '三巻目で、足音がひとつ増える。',
  'フィルムは記憶に似ている。焼けば、消える。',
  '映らないものほど、よく見えることがある。',
  '誰かが、あなたの席に座っている。',
  'あと二巻。夜が短くなる気配はない。',
  '最後の巻だ。手が震えても、回し続けること。',
]

/**
 * ループ回数に応じて足される一文。
 * 視界は悪くしない代わりに、ここと人影の距離と映写機の異音だけで回数を表現する。
 */
export const LOOP_CARDS: readonly { minLoops: number; lines: readonly string[] }[] = [
  { minLoops: 1, lines: ['さっきも、ここにいた。', 'もう一度、最初の一巻から。'] },
  { minLoops: 5, lines: ['巻き戻すたび、フィルムは短くなる。', '同じ場面を、何度も焼いている。'] },
  { minLoops: 10, lines: ['何度目かは、もう数えていない。', '夜が、同じ長さで繰り返されている。'] },
  { minLoops: 20, lines: ['出口の字幕は、まだ書かれていない。', 'あなたはずっと、この席にいる。'] },
]

export function intertitleFor(reel: number, loops: number): Intertitle {
  const main = REEL_CARDS[(reel - 1) % REEL_CARDS.length]

  // ループを表す一文は「第一巻に戻された瞬間」にだけ添える。
  // 2巻目以降にも付けると、その周のあいだ同じ一文を毎回読まされることになる。
  // ループの積み重ねは、人影の距離と映写機に混ざる異音が続けて受け持つ。
  if (reel !== 1 || loops <= 0) return { main }

  let sub: string | undefined
  for (const tier of LOOP_CARDS) {
    if (loops >= tier.minLoops) sub = tier.lines[loops % tier.lines.length]
  }
  return sub ? { main, sub } : { main }
}

/** 巻の見出し（第一巻 …） */
const KANJI = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
export function reelLabel(reel: number): string {
  return `第${KANJI[reel] ?? String(reel)}巻`
}
