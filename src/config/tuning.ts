/**
 * 調整用の数値はすべてここに集める。
 * ゲームバランス・不穏タイマーの秒数・演出の強さは、このファイルだけ触れば変えられる。
 */

export const RULES = {
  /** 全何段階で脱出か */
  totalStages: 8,
  /** 1段階あたり何本正しくさばけば次へ進むか */
  clipsPerStage: 1,
  /** 同じ種類（本物/AI）が連続してよい最大本数。5本以上連続しない＝4 */
  maxSameKindRun: 4,
  /** 同じカテゴリが連続してよい最大本数。3本以上連続しない＝2 */
  maxSameCategoryRun: 2,
  /** 先読みする本数 */
  preloadAhead: 2,
} as const

export const DREAD = {
  /**
   * 不穏タイマーの段階しきい値（ミリ秒）。
   * 0段階=しきい値未満。最後の要素に達した時点で暗転エンド。
   */
  stagesMs: [20_000, 35_000, 50_000, 60_000],
  /** 段階ごとの演出の強さ（0..1）。索引 0 = 段階1 */
  intensity: [0.25, 0.5, 0.8, 1],
  /** 映像のこの割合（中央）には演出を重ねない */
  safeCenterRatio: 0.6,
  /** 通知が届く間隔（ms）。強さが上がるほど短くなる */
  notifyIntervalMs: [9_000, 2_600] as [number, number],
} as const

export const SWIPE = {
  /** 確定に必要な横移動量（px） */
  commitDistance: 90,
  /** 距離が足りなくても確定させる速度（px/ms） */
  commitVelocity: 0.55,
  /** 最大の傾き（度） */
  maxTiltDeg: 10,
} as const

export const CUTSCENE = {
  /** ミス時：画面が一瞬固まる（ms） */
  freezeMs: 700,
  /** ミス時：読み込み中の表示（ms） */
  loadingMs: 1400,
  /** ミス時：「おすすめがリセットされました」の通知（ms） */
  resetNoticeMs: 1800,
  /** 段階が上がったときの間（ms）。0 にすると完全にノンストップ */
  stageAdvanceMs: 700,
} as const

/** 演出の強さ。設定画面の「演出を弱める」で下げられる。 */
export const FX = {
  /** 回答したときに画面が揺れる幅（px） */
  answerShakePx: 6,
  /** 不穏タイマーで落ちる明るさの下限（1 = 変化なし） */
  minBrightness: 0.62,
  /** ハートやコメント数が勝手に増える速さ（1秒あたり） */
  counterDriftPerSec: 14,
  /** 通知を同時に何件まで積むか */
  maxNotifications: 4,
} as const
