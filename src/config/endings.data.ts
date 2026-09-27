/**
 * エンディングの定義。条件も文章もここだけ触れば足せる・変えられる。
 *
 * 文章はすべて「アプリが表示しそうな文」で書くこと。
 * 語り手を出して情景を説明すると、そこでゲームに戻ってしまう。
 * 起きていることは書かず、アプリの事務的な報告だけを並べて、
 * 読んだ側が意味に気づく形にしておく。
 *
 * 1つにつき 2 行まで。
 * ここに怖さを背負わせようとすると、書き手が気を利かせている感じが出て、
 * かえって安く見える。プレイヤーは遊び終わった直後で、すでに自分で
 * 怖がっている。材料を足すより、黙っている時間のほうが持たせられる。
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
 *
 * 取りやめたエンディングも枠だけ残す。詰めると以降の並びがずれて、
 * すでに配ったセーブコードで過去の記録が別のものとして読まれてしまう。
 */
export const ENDING_ORDER: readonly string[] = [
  'closed',
  'true',
  'endless',
  /* 取りやめ: 「見すぎ」。暗転と同じ行動を測っていたうえ、到達もできなかった */
  'watched',
  'blackout',
]

/** 調整しやすいようしきい値は名前を付けておく */
export const ENDING_THRESHOLDS = {
  /** 「無限スクロール」になる累計ループ回数 */
  endlessLoops: 20,
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
      n('一定時間、操作がありませんでした', 'system', 4500),
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
      n('確認ありがとうございました', 'notice', 3200),
      n('本物と判定された動画を学習に使用しました', 'system', 4500),
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
      n('このアプリを {loops} 回開き直しました', 'record', 3600),
      n('おすすめの表示を続けます', 'system', 4500),
    ],
    hint: '何度もリセットされた末に、それでも通すこと。',
  },
  {
    id: 'closed',
    title: 'アプリを閉じる',
    trigger: 'escape',
    priority: 100,
    conditions: [],
    cards: [
      n('おすすめの表示を停止しました', 'notice', 3200),
      n('ご利用ありがとうございました', 'notice', 4200),
    ],
    hint: '八段階すべてを通して、アプリを閉じること。',
  },
]

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id)
}
