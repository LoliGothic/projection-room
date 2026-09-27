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
 * 提供者名が未記入のときに使う、当たり障りのないアカウント名。
 * 本物と AI のどちらにも同じ形で出すので、見分けの手がかりにならない。
 */
const FALLBACK_NAMES: readonly string[] = [
  'nagi.films',
  'shizuku_ch',
  'mist_and_moss',
  'aoi.walks',
  'kohaku_daily',
  'still.water',
  'hoshi_room',
  'mado_kara',
  'yuzu_scenes',
  'towa.clip',
]

/** ID から決まる 0..1 の値 */
function hashUnit(seed: string): number {
  let h = 2166136261
  for (const ch of seed) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/**
 * 表示する投稿者名。
 * ループが増えるほど、同じ名前に置き換わる割合が上がる。
 *
 * 提供者名が空のときは ID から決まる名前を当てる。
 * 片方だけ「unknown」になると、そこが手がかりになってしまうため。
 */
export function accountNameFor(
  contributor: string | undefined,
  loops: number,
  index: number,
  clipId = '',
): string {
  const base =
    contributor?.trim() ||
    FALLBACK_NAMES[Math.floor(hashUnit(clipId) * FALLBACK_NAMES.length) % FALLBACK_NAMES.length]
  if (loops <= 0) return base
  // 20 ループで半分ほどが同じ名前になる
  const ratio = Math.min(0.55, loops / 36)
  const slot = (Math.abs(index) * 7919) % 100
  return slot < ratio * 100 ? CROWDING_NAME : base
}

/**
 * コメント欄に出す書き込み。
 * ループが増えるほど、こちらに気づいているような文言が混ざる。
 *
 * どの動画にも同じ配列から選ぶので、本物か AI かの手がかりにはならない。
 */
export const COMMENTS: readonly { minLoops: number; lines: readonly string[] }[] = [
  {
    minLoops: 0,
    lines: [
      'きれい',
      'どこですか？',
      '保存しました',
      '癒される〜',
      'music名前わかる人いますか',
      '毎日見てる',
      'ここ行きたい',
      '画質すご',
      '朝から見れてよかった',
      '何回も見ちゃう',
      'おすすめに出てきた',
      '好き',
    ],
  },
  {
    minLoops: 1,
    lines: [
      'これ前も流れてきた',
      'さっき見たばかりなんだけど',
      'また出てきた',
      'アルゴリズム壊れてる？',
      'なんか見覚えある',
    ],
  },
  {
    minLoops: 5,
    lines: [
      'ここ、地図に載ってないですよね',
      '撮影者のアカウントが見つからない',
      'この場所いつのですか',
      '誰が撮ったんですか？',
      '調べたけど出てこなかった',
    ],
  },
  {
    minLoops: 10,
    lines: [
      'まだ見てるんですか',
      'そろそろ閉じたほうがいいよ',
      '何回目ですか',
      'ずっと同じところにいますね',
      '私も抜けられませんでした',
    ],
  },
  {
    minLoops: 20,
    lines: [
      'おかえりなさい',
      'ここから出た人を見たことがない',
      'もう数えていません',
      '次もまた会いましょう',
    ],
  },
]

/** コメントに添える名前 */
const COMMENT_NAMES: readonly string[] = [
  'mori_no_oto',
  'tsuki3',
  'kaze.to.hikari',
  'yoru_ni',
  'asagiri',
  'shiro_neko',
  'umi_bi',
  'kumo_no_ue',
  'hazama',
  'towa.',
  'nemuri_ya',
  'kagerou',
]

export interface Comment {
  name: string
  text: string
  likes: number
}

/** ID から決まる 0..1 の値 */
function unit(seed: string, salt: string): number {
  let h = 2166136261
  for (const ch of `${seed}:${salt}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/**
 * コメント欄の中身。
 * 同じ動画なら毎回同じ並びになる。ループが増えるほど、
 * 上のほうに「こちらに気づいている」書き込みが混ざる。
 */
export function commentsFor(clipId: string, loops: number, count = 8): Comment[] {
  const calm = COMMENTS[0].lines
  const eerie: string[] = []
  for (const tier of COMMENTS) {
    if (tier.minLoops > 0 && loops >= tier.minLoops) eerie.push(...tier.lines)
  }
  // ループが増えるほど、不穏な書き込みの割合が上がる
  const eerieCount = eerie.length === 0 ? 0 : Math.min(count - 1, Math.round(loops / 4))

  const out: Comment[] = []
  for (let i = 0; i < count; i++) {
    const useEerie = i < eerieCount
    const pool = useEerie ? eerie : calm
    const pick = Math.floor(unit(clipId, `c${i}`) * pool.length)
    out.push({
      name: COMMENT_NAMES[Math.floor(unit(clipId, `n${i}`) * COMMENT_NAMES.length)],
      text: pool[pick % pool.length],
      likes: Math.floor(unit(clipId, `l${i}`) * 240),
    })
  }
  return out
}

/** 段階の見出し */
export function stageLabel(stage: number): string {
  return `${stage} / 8`
}
