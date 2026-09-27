/**
 * エンディングの定義。条件も文章もここだけ触れば足せる・変えられる。
 *
 * 文章はすべて「アプリが表示しそうな文」で書くこと。
 * 語り手を出して情景を説明すると、そこでゲームに戻ってしまう。
 * 起きていることは書かず、アプリの事務的な報告だけを並べて、
 * 読んだ側が意味に気づく形にしておく。
 *
 * 短くして前後に間を取る見せ方もできる（leadMs / settleMs）。
 * 文章に怖さを背負わせようとすると、書き手が気を利かせている感じが出て
 * かえって安く見えるので、そこを避けたいときに使う。
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
 * 出す文。囲いは付けず、黒い画面に文字だけを出す。
 *
 * はじめは通知として囲うものと、画面そのものに出すものを分けていたが、
 * どちらも画面の中央に出していたため、意味のある区別に見えず
 * ただ不揃いなだけになっていた。
 */
export interface EndingCard {
  text: string
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
  /**
   * 最初の文が出るまで、暗いまま待つ時間（ms）。既定は 0。
   * 文を減らして間で持たせたいときだけ指定する。
   */
  leadMs?: number
  /** 最後の文が消えてから、締めの画面が出るまで（ms）。既定は 1400 */
  settleMs?: number
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

const n = (text: string, holdMs: number): EndingCard => ({ text, holdMs })

export const ENDINGS: readonly EndingDef[] = [
  {
    id: 'blackout',
    title: '暗転',
    trigger: 'darkness',
    priority: 0,
    conditions: [],
    /*
      ここだけ文を 1 行に絞り、前後を暗いまま持たせる。
      プレイヤーは 60 秒画面を見つめ続けた直後で、すでに自分で怖がっている。
      材料を足すより、黙っている時間のほうが効く。
    */
    leadMs: 3000,
    settleMs: 4000,
    cards: [
      n('一定時間、操作がありませんでした', 4500),
    ],
    hint: '1本の動画を、長く見つめすぎると。',
  },
  {
    id: 'true',
    title: '撮影者',
    trigger: 'escape',
    priority: 10,
    conditions: [{ stat: 'loops', op: 'eq', value: 0 }],
    cards: [
      n('確認ありがとうございました', 2600),
      /*
        材料になっていたのは偽物ではなく本物のほう、という置き方。
        本物が本物だったことは否定していない。よくできた偽物を作るのに
        要るのは本物なので、理屈も通る。
      */
      n('本物と判定された動画を学習に使用しました', 5200),
    ],
    hint: '一度もリセットされずにクリアすること。',
  },
  {
    id: 'endless',
    title: '無限スクロール',
    trigger: 'escape',
    priority: 20,
    conditions: [{ stat: 'loops', op: 'gt', value: ENDING_THRESHOLDS.endlessLoops }],
    cards: [
      n('8段階を完了しました', 2600),
      n('このアプリを {loops} 回開き直しました', 3000),
      // 通したのに、やめる資格がないと言われる
      n('利用を終了する条件を確認しています', 2800),
      n('条件を満たしていません', 3200),
      n('おすすめの表示を続けます', 4400),
    ],
    hint: '何度もリセットされた末に、それでもクリアすること。',
  },
  {
    id: 'closed',
    title: 'アプリを閉じる',
    trigger: 'escape',
    priority: 100,
    conditions: [],
    cards: [
      n('おすすめの表示を停止しました', 2400),
      n('ご利用ありがとうございました', 2600),
      /*
        五つのうち、これだけ最後まで異常が無い。
        ほかを見たあとだと、何も起きないことのほうが信じられなくなる。
        素直に通した人へのご褒美が「何も無い」という置き方。
      */
      n('アプリを終了します', 3400),
    ],
    hint: '8段階すべてをクリアすること。',
  },
]

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id)
}
