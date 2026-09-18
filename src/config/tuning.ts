/**
 * 調整用の数値はすべてここに集める。
 * ゲームバランス・不穏タイマーの秒数・演出の強さは、このファイルだけ触れば変えられる。
 */

export const RULES = {
  /** 全何巻で脱出か。連続で正解すべき本数は totalReels * clipsPerReel */
  totalReels: 8,
  /** 1巻あたり何本正しくさばけば次の巻へ進むか */
  clipsPerReel: 1,
  /** 同じ種類（本物/AI）が連続してよい最大本数。5本以上連続しない＝4 */
  maxSameKindRun: 4,
  /** 先読みする本数 */
  preloadAhead: 2,
} as const

export const DREAD = {
  /**
   * 不穏タイマーの段階しきい値（ミリ秒）。
   * 0段階=しきい値未満。最後の要素に達した時点で暗闇エンド。
   */
  stagesMs: [20_000, 35_000, 50_000, 60_000],
  /** 段階ごとの演出の強さ（0..1）。索引 0 = 段階1 */
  intensity: [0.25, 0.5, 0.8, 1],
  /** 映像中央のこの割合には演出を重ねない */
  safeCenterRatio: 0.6,
} as const

export const SWIPE = {
  /** 確定に必要な横移動量（px） */
  commitDistance: 90,
  /** 距離が足りなくても確定させる速度（px/ms） */
  commitVelocity: 0.55,
  /** 最大の傾き（度） */
  maxTiltDeg: 12,
  /** 画面外へ飛ばすアニメーションの時間（ms） */
  flyOutMs: 220,
} as const

export const CUTSCENE = {
  /** 巻の節目の暗転＋字幕カード（ms） */
  intertitleMs: 2600,
  /** ミス時：映写機が止まって焦げ跡が広がる（ms） */
  burnMs: 900,
  /** ミス時：暗転（ms） */
  blackoutMs: 500,
  /** ミス時：巻き戻し（ms） */
  rewindMs: 1100,
} as const

/** 演出の強さ。設定画面の「点滅を弱める」「演出を軽くする」で上書きされる。 */
export const FX = {
  /** 映像全体の揺れ幅（px） */
  jitterPx: 2,
  /** 数十秒に一度の上下跳ねの幅（px）と発生間隔（ms） */
  hopPx: 5,
  hopIntervalMs: [18_000, 46_000] as [number, number],
  /** 明るさの揺らぎ幅（0.01 = 1%） */
  brightnessWobble: 0.03,
  /** 動画切替時に挟むリーダーフィルムのフレーム数相当（ms） */
  leaderMs: 120,
  /** 余白を横切る人影の発生間隔（ms） */
  silhouetteIntervalMs: [90_000, 210_000] as [number, number],
  /** フィルム粒子の濃さ（0..1） */
  grain: 0.32,
} as const
