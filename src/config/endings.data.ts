/**
 * エンディングの定義。条件も文章もここだけ触れば足せる・変えられる。
 * 文章は仮のもの。
 */

/** 何をきっかけに判定するか */
export type Trigger = 'escape' | 'darkness'

/** 条件に使えるプレイ中の統計 */
export type StatKey =
  | 'loops'
  | 'burnedReal'
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
  /** 字幕カード風に 1 枚ずつ出す文章 */
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
  'dawn',
  'true',
  'endless',
  'worn',
  'darkness',
]

/** 調整しやすいようしきい値は名前を付けておく */
export const ENDING_THRESHOLDS = {
  /** 「終わらない上映」になる累計ループ回数 */
  endlessLoops: 20,
  /** 「擦り切れたフィルム」になる 1本あたりの平均リプレイ回数 */
  wornAvgReplays: 3,
} as const

export const ENDINGS: readonly EndingDef[] = [
  {
    id: 'darkness',
    title: '暗闇',
    trigger: 'darkness',
    priority: 0,
    conditions: [],
    cards: [
      'フィルムを見つめすぎた。',
      '映写機は、あなたを待つのをやめた。',
      '暗い客席に、拍手の音だけが残っている。',
    ],
    hint: '一本のフィルムを、長く見つめすぎると。',
  },
  {
    id: 'true',
    title: '完全上映',
    trigger: 'escape',
    priority: 10,
    conditions: [{ stat: 'loops', op: 'eq', value: 0 }],
    cards: [
      '八巻。一度も止めずに回しきった。',
      '扉の向こうは、ただの朝だった。',
      '映写室の灯りを落として、あなたは外へ出る。',
      'もう、誰も座っていない。',
    ],
    hint: '一度も第一巻に戻らずに、八巻を通すこと。',
  },
  {
    id: 'endless',
    title: '終わらない上映',
    trigger: 'escape',
    priority: 20,
    conditions: [{ stat: 'loops', op: 'gt', value: ENDING_THRESHOLDS.endlessLoops }],
    cards: [
      '八巻を通した。扉が開く。',
      '外は暗い廊下で、その先にまた扉があった。',
      '開けると、映写機が回っている。',
      '出口を出たはずが、また映写室だった。',
    ],
    hint: '何度も何度も第一巻に戻された末に、それでも通すこと。',
  },
  {
    id: 'worn',
    title: '擦り切れたフィルム',
    trigger: 'escape',
    priority: 30,
    conditions: [
      { stat: 'avgReplays', op: 'gte', value: ENDING_THRESHOLDS.wornAvgReplays },
    ],
    cards: [
      '確かめて、確かめて、確かめた。',
      'あなたが回した分だけ、フィルムは薄くなった。',
      '八巻を通したとき、手元に残っていたのは擦り切れた帯だけだった。',
    ],
    hint: '同じ場面を、何度も何度も回し直しながら通すこと。',
  },
  {
    id: 'dawn',
    title: '夜明け',
    trigger: 'escape',
    priority: 100,
    conditions: [],
    cards: [
      '最後の一巻が、静かに終わる。',
      '非常口の灯りが、白く変わっていく。',
      '夜が明けた。あなたは映画館を出る。',
    ],
    hint: '八巻すべてを通して、映画館を出ること。',
  },
]

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id)
}
