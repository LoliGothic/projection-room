/**
 * フィードに表示する文言。ここだけ触れば差し替えられる。
 *
 * ループ回数が増えるほど、キャプションが不穏になり、投稿者名に同じ名前が増え、
 * 通知の数字が膨らむ。映像そのものは変えない。
 */

/** ループ回数の段ごとのキャプション */
export const CAPTIONS: readonly { minLoops: number; lines: readonly string[] }[] = [
  {
    minLoops: 0,
    lines: [
      '今日はいい天気でした',
      '散歩の途中で',
      'お気に入りの場所',
      'なんでもない一日',
      'また来ます',
      'ここ、好きなんです',
    ],
  },
  {
    minLoops: 1,
    lines: [
      'また同じところに来てしまった',
      'さっきも撮った気がする',
      '見覚えがありますか？',
      'この場所、前にも出てきました',
      'まだ見ていますね',
    ],
  },
  {
    minLoops: 5,
    lines: [
      'あなたにだけ表示されています',
      '誰も撮っていない場所です',
      'ここに来たことはありますか',
      'おすすめが合っていますか？',
      'もう一度おすすめします',
    ],
  },
  {
    minLoops: 10,
    lines: [
      'まだ見ているんですね',
      '何回目か、数えていますか',
      'この動画は誰が撮ったのでしょう',
      'あなたの後ろが写っています',
      '保存しておきました',
    ],
  },
  {
    minLoops: 20,
    lines: [
      'ここから出た人はいません',
      'おすすめは終わりません',
      'あなたのための一覧です',
      'まだ続きがあります',
    ],
  },
]

/**
 * ループが増えると、フィードにこの名前ばかりが並ぶようになる。
 * どの動画にも付きうるので、答えの手がかりにはならない。
 */
export const CROWDING_NAME = 'you_were_here'

/** 不穏タイマーで届く通知 */
export const DREAD_NOTICES: readonly string[] = [
  'この動画をおすすめしました',
  '同じ動画を見ている人がいます',
  'あなたの視聴履歴を更新しました',
  '新しいおすすめが見つかりました',
  'まだ再生されています',
  'この場所を記録しました',
  'おすすめの精度が上がりました',
]

/** ミスしたときの通知 */
export const RESET_NOTICE = 'おすすめをリセットしました'

/** ループ回数に応じたキャプションを選ぶ */
export function captionFor(loops: number, index: number): string {
  let tier = CAPTIONS[0]
  for (const t of CAPTIONS) if (loops >= t.minLoops) tier = t
  return tier.lines[Math.abs(index) % tier.lines.length]
}

/**
 * 表示する投稿者名。
 * ループが増えるほど、同じ名前に置き換わる割合が上がる。
 */
export function accountNameFor(
  contributor: string | undefined,
  loops: number,
  index: number,
): string {
  const base = contributor?.trim() || 'unknown'
  if (loops <= 0) return base
  // 20 ループで半分ほどが同じ名前になる
  const ratio = Math.min(0.55, loops / 36)
  const slot = (Math.abs(index) * 7919) % 100
  return slot < ratio * 100 ? CROWDING_NAME : base
}

/** 段階の見出し */
export function stageLabel(stage: number): string {
  return `${stage} / 8`
}
