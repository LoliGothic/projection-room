import { pickBy, unitHash } from '../core/hash'

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
  // 提供者名が未記入でも「unknown」とは出さない。
  // 片方だけそうなると、そこが手がかりになってしまう
  const base = contributor?.trim() || accountHandle(clipId)
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
    'きれいすぎる',
    'うつくしい',
    'すご',
    'すごい…',
    'やば',
    'えぐい',
    '神',
    '最高',
    '好き',
    'すき',
    'めっちゃいい',
    'ずっと見てられる',
    '何回も見ちゃう',
    '無限に見れる',
    'ため息出た',
    '鳥肌',
    '言葉が出ない',
    '心が洗われる',
    '癒される〜',
    '癒し',
    '落ち着く',
    'ほっとする',
    '泣いた',
    '涙出てきた',
    'なんか泣ける',
    '元気もらえた',
    '救われた',
    '朝から見れてよかった',
    '寝る前に見るやつ',
    '寝れない夜に見てる',
    '通勤中に見てる',
    '休憩中に見てる',
    '仕事行きたくなくなった',
    '仕事の手が止まった',
    '明日もがんばれる',
    '現実に戻りたくない',
    'ここで暮らしたい',
    '行ってみたい',
    'いつか行きます',
    'next trip ここにします',
    'どこですか？',
    'ここどこですか',
    '場所知りたいです',
    '場所教えてください🙏',
    '何県ですか？',
    '日本ですか？',
    '海外っぽい',
    'season いつ頃ですか',
    '時期はいつがいいですか',
    '朝ですか夕方ですか',
    '保存しました',
    '保存した',
    'ブクマ',
    'メモメモ',
    '待ち受けにした',
    '壁紙にしたい',
    'スクショした',
    'シェアさせてください',
    '友達に送った',
    '家族に見せた',
    'music名前わかる人いますか',
    'BGM教えてください',
    '曲名なんですか？',
    '音源知りたい',
    'この音好き',
    '音もいい',
    'カメラ何使ってますか',
    '機材気になる',
    '撮影上手すぎ',
    '構図が good',
    '色味が好み',
    '編集うま',
    '画質すご',
    '4K で見たい',
    '本物？加工？',
    'これ加工なしですか',
    '生で見たらもっとすごいんだろうな',
    'おすすめに出てきた',
    'なんで今これが流れてきたんだろ',
    'アルゴリズムありがとう',
    'おすすめ有能',
    'たまたま見つけた',
    '初めて見た',
    'フォローしました',
    'フォローさせてもらいます',
    '毎日見てる',
    '毎回楽しみ',
    '新作待ってます',
    '続き見たい',
    'もっと長いバージョンないですか',
    '通知オンにしました',
    '1番好きかも',
    'これは伸びる',
    'バズれ',
    'もっと評価されてほしい',
    'なんでこれ伸びてないの',
    'みんな見て',
    'friends にも教えた',
    '同じ場所に行ったことある',
    '去年行きました',
    '懐かしい',
    '子供の頃に見た景色',
    'おばあちゃんちの近く',
    '地元です',
    '近所でびっくりした',
    '知ってる場所だ',
    'わかる',
    'ほんとそれ',
    'それな',
    '同じこと思った',
    '共感しかない',
    'ありがとう',
    'ありがとうございます',
    '感謝',
    'おつかれさまです',
    'いい一日になりそう',
    'おやすみなさい',
    'おはようございます',
    'こんばんは',
    '深夜に見るやつ',
    '午前3時',
    'また来ました',
    'また見に来た',
    '何回目だろう',
    '2回目です',
    '3回目',
    'リピートしてる',
    '音量上げて見てほしい',
    'イヤホン推奨',
    'フルスクリーンで見た',
    '大画面で見たい',
    '呼吸忘れてた',
    '時間溶けた',
    '5分見てた',
    '気づいたら終わってた',
    'もう一回',
    'loop してる',
    '止まらない',
    '落ち着いて見れる',
    'ゆっくりできた',
    '静かでいい',
    '音がないのもいい',
    'すーっとした',
    '深呼吸した',
    'なんかいいね',
    'いいね押した',
    '❤️',
    '😭',
    '🥹',
    '✨',
    '🌊',
    '🍃',
    'great',
    'beautiful',
    'wow',
    'love this',
    'amazing',
    ],
  },
  {
    minLoops: 1,
    lines: [
      'これ前も流れてきた',
      'さっき見たばかりなんだけど',
      'また出てきた',
      '今日3回目',
      'アルゴリズム壊れてる？',
      'なんか見覚えある',
      'デジャヴ',
      '同じの何回も出てくる',
      'さっきと同じですよね',
      'リロードしても同じ',
      'おすすめ、これしか出てこない',
      '他の動画が出てこないんだけど',
      'なんで繰り返すの',
      '履歴に残ってないのに見覚えある',
      'これ見た記憶がある',
    ],
  },
  {
    minLoops: 5,
    lines: [
      'ここ、地図に載ってないですよね',
      '調べたけど出てこなかった',
      '検索しても一件もヒットしない',
      '撮影者のアカウントが見つからない',
      'プロフィール消えてます',
      '投稿者って実在します？',
      'この場所いつのですか',
      '誰が撮ったんですか？',
      '撮影日が未来になってる',
      '同じ場所の動画が何百件もある',
      '全部同じ人が上げてる',
      '通報しても消えない',
      'ブロックしても出てくる',
      '誰も答えてくれない',
      'コメントが増えていってる',
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
      '寝てないでしょ',
      '画面から離れて',
      '後ろ、見ないほうがいいですよ',
      '部屋の明かりつけて',
      '今何時か分かりますか',
      'あなたの番です',
      '返事しないでください',
      '見てるのは動画だけじゃない',
      'このコメント、あなたにしか見えていません',
      '既読がつきました',
    ],
  },
  {
    minLoops: 20,
    lines: [
      'おかえりなさい',
      'ここから出た人を見たことがない',
      'もう数えていません',
      '次もまた会いましょう',
      'ずっとここにいましたよ',
      'はじめましてじゃないですね',
      '何度目かは聞きません',
      'わたしも最初はそう思っていました',
      '出口はありません',
      'おすすめは終わりません',
      'あなたの分も見ておきます',
      'また明日',
    ],
  },
]

/**
 * アカウント名は部品の組み合わせで作る。
 * 一覧を直接持つと数十件で頭打ちになり、同じ名前ばかり並んで見える。
 */
const NAME_HEADS: readonly string[] = [
  'mori', 'tsuki', 'kaze', 'yoru', 'asagiri', 'shiro', 'umi', 'kumo',
  'hazama', 'towa', 'nemuri', 'kagerou', 'hikari', 'mizu', 'ao', 'yuki',
  'hoshi', 'nami', 'sora', 'kusa', 'ame', 'kiri', 'hana', 'fuyu',
  'natsu', 'haru', 'aki', 'kage', 'shizuku', 'tori', 'iwa', 'tani',
  'nagi', 'miya', 'sugi', 'take', 'ishi', 'yama', 'kawa', 'no',
]
const NAME_TAILS: readonly string[] = [
  '', '_no_oto', '.bi', '_ya', '_ni', '.neko', '_no_ue', '_to_hikari',
  '_days', '.room', '_log', '.film', '_camera', '_memo', '.note', '_life',
  '_walk', '.trip', '_scene', '.view', '_time', '.rec', '_clip', '.photo',
]
const NAME_SUFFIXES: readonly string[] = [
  '', '', '', '_', '.', '3', '7', '22', '08', 'ch', 'tv', 'x',
]

/** ID から決まるアカウント名。同じ入力なら毎回同じ */
export function accountHandle(...parts: readonly string[]): string {
  return (
    pickBy(NAME_HEADS, ...parts, 'h') +
    pickBy(NAME_TAILS, ...parts, 't') +
    pickBy(NAME_SUFFIXES, ...parts, 's')
  )
}

export interface Comment {
  name: string
  text: string
  likes: number
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
  const usedText = new Set<string>()
  const usedName = new Set<string>()

  for (let i = 0; i < count; i++) {
    const pool = i < eerieCount ? eerie : calm
    // 同じ書き込みが並ばないよう、重なったら少しずらして引き直す
    let text = pickBy(pool, clipId, `c${i}`)
    for (let retry = 1; usedText.has(text) && retry < pool.length; retry++) {
      text = pickBy(pool, clipId, `c${i}`, `r${retry}`)
    }
    usedText.add(text)

    let name = accountHandle(clipId, `n${i}`)
    for (let retry = 1; usedName.has(name) && retry < 8; retry++) {
      name = accountHandle(clipId, `n${i}`, `r${retry}`)
    }
    usedName.add(name)

    out.push({ name, text, likes: Math.floor(unitHash(clipId, `l${i}`) * 240) })
  }
  return out
}

/** 段階の見出し */
export function stageLabel(stage: number): string {
  return `${stage} / 8`
}
