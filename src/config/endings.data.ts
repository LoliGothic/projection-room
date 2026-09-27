/**
 * エンディングの定義。条件も文章もここだけ触れば足せる・変えられる。
 *
 * 文章はすべて「アプリが表示しそうな文」で書くこと。
 * 語り手を出して情景を説明すると、そこでゲームに戻ってしまう。
 * 起きていることは書かず、アプリの事務的な報告だけを並べて、
 * 読んだ側が意味に気づく形にしておく。
 */

/** 何をきっかけに判定するか */
export type Trigger = 'escape' | 'darkness'

/** 条件に使えるプレイ中の統計 */
export type StatKey =
  | 'loops'
  | 'reportedReal'
  | 'missedAI'
  | 'replays'
  | 'presented'
  | 'correct'
  /** 1本あたりの平均リプレイ回数 */
  | 'avgReplays'

export type Op = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

export interface Condition {
  stat: StatKey
  op: Op
  value: number
}

/**
 * 文の見せ方。
 * - notice 通知として出る。続けて並ぶと下に溜まっていく
 * - system 画面そのものに出る。前の文と入れ替わる
 * - record 記録の画面として出る。数字を見せるとき
 */
export type CardAs = 'notice' | 'system' | 'record'

export interface EndingCard {
  text: string
  as: CardAs
  /** 次の文に移るまで（ms） */
  holdMs: number
}

export interface EndingDef {
  id: string
  /** エンディング画面と一覧に出す名前 */
  title: string
  trigger: Trigger
  /** 小さいほど先に判定する */
  priority: number
  /** すべて満たしたときに成立（AND）。空なら無条件 */
  conditions: Condition[]
  /** 1枚ずつ出す文章 */
  cards: EndingCard[]
  /** 演出用動画の clips.json 上の ID（任意） */
  clipId?: string
  /** 一覧で未達成のときに出すヒント */
  hint: string
}

/**
 * セーブコードの互換性のため、この並びは変えないこと。
 * 追加するときは必ず末尾に足す。
 */
export const ENDING_ORDER: readonly string[] = [
  'closed',
  'true',
  'endless',
  'watched',
  'blackout',
]

/** 調整しやすいようしきい値は名前を付けておく */
export const ENDING_THRESHOLDS = {
  /** 「無限スクロール」になる累計ループ回数 */
  endlessLoops: 20,
  /** 「見すぎ」になる 1本あたりの平均リプレイ回数 */
  watchedAvgReplays: 3,
} as const

/**
 * 文中に差し込めるプレイ中の数字。
 *
 * 作り物の数字より、その人が実際に出した数字のほうがはるかに効く。
 * アプリが手元の記録を読み上げている形になるため。
 */
export interface EndingNumbers {
  presented: number
  replays: number
  loops: number
  correct: number
}

/** {presented} のような差し込みを埋める */
export function fillCard(text: string, numbers?: EndingNumbers): string {
  if (!numbers) return text.replace(/\{\w+\}/g, '—')
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = (numbers as unknown as Record<string, number | undefined>)[key]
    return value === undefined ? whole : value.toLocaleString('ja-JP')
  })
}

const n = (text: string, as: CardAs, holdMs: number): EndingCard => ({ text, as, holdMs })

export const ENDINGS: readonly EndingDef[] = [
  {
    id: 'blackout',
    title: '暗転',
    trigger: 'darkness',
    priority: 0,
    conditions: [],
    cards: [
      // 何も起きていないふりから始める。省電力は誰もが見たことのある文言
      n('省電力のため、画面を暗くしました', 'notice', 2600),
      n('おすすめの動画が見つかりました', 'notice', 2800),
      n('撮影者: 不明', 'system', 2600),
      n('撮影場所: この端末の位置情報と一致します', 'system', 3400),
      // 終わらせず、送っている途中で切る
      n('1 件の動画をアップロードしています', 'system', 4000),
    ],
    hint: '一本の動画を、長く見つめすぎると。',
  },
  {
    id: 'true',
    title: '撮影者',
    trigger: 'escape',
    priority: 10,
    conditions: [{ stat: 'loops', op: 'eq', value: 0 }],
    cards: [
      n('ご協力ありがとうございました', 'notice', 2400),
      n('{presented} 件の動画を確認しました', 'notice', 2800),
      n('報告された動画は、すべて同一の投稿者によるものでした', 'system', 3400),
      n('投稿者: 撮影者不明', 'system', 3000),
      // ここだけが本題。事務的に置く
      n('この端末から投稿されています', 'system', 4000),
      n('アプリを終了します', 'system', 2400),
    ],
    hint: '一度もリセットされずに、八段階を通すこと。',
  },
  {
    id: 'endless',
    title: '無限スクロール',
    trigger: 'escape',
    priority: 20,
    conditions: [{ stat: 'loops', op: 'gt', value: ENDING_THRESHOLDS.endlessLoops }],
    cards: [
      n('アプリを終了します', 'system', 2800),
      n('おすすめを更新しました', 'notice', 2400),
      // 通知は下に溜まっていく。数字だけが増えていく
      n('新しい動画が 1 件あります', 'notice', 1500),
      n('新しい動画が 34 件あります', 'notice', 1100),
      n('新しい動画が 2,806 件あります', 'notice', 900),
      n('更新を停止できません', 'system', 4000),
    ],
    hint: '何度もリセットされた末に、それでも通すこと。',
  },
  {
    id: 'watched',
    title: '見すぎ',
    trigger: 'escape',
    priority: 30,
    conditions: [{ stat: 'avgReplays', op: 'gte', value: ENDING_THRESHOLDS.watchedAvgReplays }],
    cards: [
      n('視聴の記録がまとまりました', 'notice', 2400),
      n('見返した回数　{replays} 回', 'record', 3000),
      n('もっとも長く見た動画を共有しました', 'system', 3200),
      n('共有先: 撮影者不明', 'system', 3200),
      n('共有を取り消せません', 'system', 4000),
    ],
    hint: '同じ動画を何度も見返しながら通すこと。',
  },
  {
    id: 'closed',
    title: 'アプリを閉じる',
    trigger: 'escape',
    priority: 100,
    conditions: [],
    cards: [
      n('おすすめの表示を停止しました', 'notice', 2600),
      n('ご利用ありがとうございました', 'notice', 2600),
      n('アプリを終了します', 'system', 3000),
      // 何も起きないまま終わる。最後の一文だけが約束になっている
      n('またあとで表示します', 'system', 4000),
    ],
    hint: '八段階すべてを通して、アプリを閉じること。',
  },
]

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id)
}
