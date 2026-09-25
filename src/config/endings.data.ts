/**
 * エンディングの定義。条件も文章もここだけ触れば足せる・変えられる。
 * 文章は仮のもの。
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

export interface EndingDef {
  id: string
  /** エンディング画面と一覧に出す名前 */
  title: string
  trigger: Trigger
  /** 小さいほど先に判定する */
  priority: number
  /** すべて満たしたときに成立（AND）。空なら無条件 */
  conditions: Condition[]
  /** 通知やメッセージ風に 1 枚ずつ出す文章 */
  cards: string[]
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

export const ENDINGS: readonly EndingDef[] = [
  {
    id: 'blackout',
    title: '暗転',
    trigger: 'darkness',
    priority: 0,
    conditions: [],
    cards: [
      '画面が暗くなりました。',
      '映っているのは、あなたの部屋です。',
      'カメラは、ずっと前から起動していました。',
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
      '八段階。一度も間違えずに通しました。',
      '報告した動画の投稿者は、すべて同じ端末から上げられていました。',
      '登録されていた名前は、あなたのものでした。',
      'アプリを閉じます。',
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
      '八段階を通しました。アプリを閉じます。',
      'ホーム画面に戻りました。',
      '……アプリが開いています。',
      '最初の動画が、また再生されています。',
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
      '確かめて、確かめて、確かめました。',
      '視聴時間の記録が更新されました。',
      'あなたが見た回数だけ、向こうもあなたを見ていました。',
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
      '八段階を通しました。',
      'おすすめの表示を停止しました。',
      'アプリを閉じます。おつかれさまでした。',
    ],
    hint: '八段階すべてを通して、アプリを閉じること。',
  },
]

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id)
}
