/**
 * 本物とAIを同じ質感に揃えるための共通処理。
 * import:saved / import:ai / prep:clip / gen:real がすべてこれを通る。
 *
 * 測ってみると、素のままでは 2 つの群がはっきり分かれていた:
 *   明るさ      本物 平均35.8 / AI 平均56.7   … AI は明るい
 *   黒つぶれ率  本物 平均54.3% / AI 平均24.7% … AI は黒が締まらない
 *   細部        本物 2.6〜13.7 / AI 3.5〜5.6  … AI は均質で、ばらつきが無いこと自体が手がかり
 *
 * そこで
 *   ① 1本ずつ明るさを測り、共通の目標値に寄せる（どちらの群にも同じ処理）
 *   ② 粒子・軟らかさ・コントラスト・周辺減光を、IDから決まる範囲で1本ずつ散らす
 * の 2 段構えにしている。②は本物にもかけるので、どちらの群も同じだけばらつく。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const GEOMETRY = {
  fps: 18,
  width: 480,
  height: 360,
}

/**
 * 仕上がりの目標。周辺減光やコントラストは後段で効くので、
 * 途中の値ではなく「最後まで通した結果」を測って合わせる。
 */
export const TARGET = {
  /**
   * 目標の平均輝度（0-255）。
   * 低くしすぎると、明るい屋外の画（AI側に多い）が不自然に潰れて見える。
   */
  brightness: 47,
  /** 目標の細部の量（隣接画素の差の平均）。本物側の中央値あたり */
  detail: 5.5,
  /** 目標のコントラスト（輝度の標準偏差）。本物側の中央値あたり */
  contrast: 45,
  gammaMin: 0.35,
  gammaMax: 3.2,
  contrastMin: 0.6,
  contrastMax: 2.1,
  /** 何回まで測り直して寄せるか */
  passes: 7,
}

/** 1本ずつ散らす範囲。上限と下限は本物側の実測ばらつきに合わせてある */
export const SPREAD = {
  noise: [9, 20],
  contrast: [1.06, 1.34],
  /** 負ならシャープ、正ならソフト */
  softness: [-0.45, 0.65],
  /**
   * 周辺減光。PI/x の x なので、大きいほど弱い。
   * 強すぎると、画面の端まで明るい画（AI側に多い）で黒い輪が目立つ。
   */
  vignette: [3.6, 5.2],
  /**
   * 撮影コマ数。無声映画は毎秒16コマ前後で撮られ、上映では
   * コマが重複してカクついて見える。AI動画にはこの癖が無く、動きが滑らかすぎる。
   * ここで1本ずつコマ数を落としてから18fpsに戻し、両群に同じだけカクつきを作る。
   */
  shootRate: [11, 16],
}

/** ID から決まる 0..1 の値（同じ入力なら毎回同じ） */
function hashUnit(seed, salt) {
  let h = 2166136261
  for (const ch of `${seed}:${salt}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

const lerp = (range, t) => range[0] + (range[1] - range[0]) * t

/** 解析用に小さく取り出すサイズ */
const PROBE_W = 240
const PROBE_H = 180

/** 幾何だけ整えるフィルタ（明るさを測る前に通す） */
export function geometryChain(trim, seed) {
  const chain = []
  if (trim) chain.push(`crop=iw-${trim.left}:ih-${trim.top}:${trim.left}:${trim.top}`)
  // 撮影コマ数まで落としてから 18fps に戻す。コマが重複してカクつく
  if (seed !== undefined) {
    const shoot = Math.round(lerp(SPREAD.shootRate, hashUnit(seed, 'shoot')))
    chain.push(`fps=${shoot}`)
  }
  chain.push(
    `fps=${GEOMETRY.fps}`,
    `scale=${GEOMETRY.width}:${GEOMETRY.height}:force_original_aspect_ratio=increase`,
    `crop=${GEOMETRY.width}:${GEOMETRY.height}`,
    'setsar=1',
    'format=gray',
  )
  return chain.join(',')
}

export const LEVELS = 'normalize=blackpt=black:whitept=white:smoothing=40'

/**
 * フィルタ列を通した結果の「平均輝度」と「細部の量」を測る。
 * 細部は隣接画素の差の平均で、粒子の乗り方と解像感の両方を含む。
 */
export async function probe(input, chain) {
  const { stdout } = await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', input, '-an', '-t', '10',
    '-vf', `${chain},fps=3,scale=${PROBE_W}:${PROBE_H}`,
    '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
  ], { encoding: 'buffer', maxBuffer: 1 << 28 })

  const size = PROBE_W * PROBE_H
  let frames = 0
  let meanSum = 0
  let detailSum = 0
  let sdSum = 0

  for (let off = 0; off + size <= stdout.length; off += size) {
    const b = stdout.subarray(off, off + size)
    let sum = 0
    for (let i = 0; i < size; i++) sum += b[i]
    const mean = sum / size
    meanSum += mean

    let variance = 0
    for (let i = 0; i < size; i++) variance += (b[i] - mean) ** 2
    sdSum += Math.sqrt(variance / size)

    let diff = 0
    let count = 0
    for (let y = 1; y < PROBE_H; y++) {
      for (let x = 1; x < PROBE_W; x++) {
        const i = y * PROBE_W + x
        diff += Math.abs(b[i] - b[i - 1]) + Math.abs(b[i] - b[i - PROBE_W])
        count += 2
      }
    }
    detailSum += diff / count
    frames++
  }

  if (frames === 0) {
    return { mean: TARGET.brightness, detail: TARGET.detail, sd: TARGET.contrast }
  }
  return { mean: meanSum / frames, detail: detailSum / frames, sd: sdSum / frames }
}

/**
 * ガンマは合成すると指数がかけ算になる。
 * いまガンマ g で平均 m になっているとき、目標 t に寄せるには
 * g' = g * log(m/255) / log(t/255)
 */
function nextGamma(gamma, mean) {
  const m = Math.min(250, Math.max(2, mean))
  const k = Math.log(m / 255) / Math.log(TARGET.brightness / 255)
  // そのまま当てると行き過ぎて振動する（極端に暗い転写で顕著）。半分だけ動かす
  const damped = 1 + (k - 1) * 0.55
  return Math.min(TARGET.gammaMax, Math.max(TARGET.gammaMin, gamma * damped))
}

/**
 * 仕上げのフィルタ列を作る。
 * seed には動画の ID を渡す（同じ ID なら毎回同じ見た目になる）。
 * gamma と sharpen は solveLook が決めた値を渡す。
 */
export function lookChain({ gamma, sharpen, contrast, lift = 0 }, seed, trim) {
  const noise = lerp(SPREAD.noise, hashUnit(seed, 'noise'))
  const vignette = lerp(SPREAD.vignette, hashUnit(seed, 'vig'))

  const chain = [geometryChain(trim, seed), LEVELS]
  chain.push(
    `eq=contrast=${contrast.toFixed(3)}:gamma=${gamma.toFixed(3)}:brightness=${lift.toFixed(4)}`,
  )

  // 転写ごとの解像感の差。プラスならシャープ、マイナスなら甘い転写
  if (sharpen > 0.04) chain.push(`unsharp=5:5:${sharpen.toFixed(2)}`)
  else if (sharpen < -0.04) chain.push(`gblur=sigma=${(-sharpen).toFixed(2)}`)

  chain.push(`noise=alls=${Math.round(noise)}:allf=t+u`)
  chain.push(`vignette=PI/${vignette.toFixed(2)}`)

  return chain.join(',')
}

/**
 * 実際に通した結果を測りながら、明るさと細部を目標へ寄せる値を探す。
 * 途中の値で計算すると、後段の周辺減光やコントラストで大きくずれるため、
 * 必ず最後まで通した結果を見る。
 */
export async function solveLook(input, seed, trim) {
  // 1本ずつばらつかせた目標。どちらの群にも同じ範囲で効くので、
  // 「AIだけ均質」という手がかりにはならない
  const targetDetail = TARGET.detail * (0.75 + hashUnit(seed, 'detail') * 0.75)
  const targetContrast = TARGET.contrast * (0.88 + hashUnit(seed, 'sd') * 0.3)

  let params = {
    gamma: 1,
    sharpen: lerp(SPREAD.softness, hashUnit(seed, 'soft')),
    contrast: lerp(SPREAD.contrast, hashUnit(seed, 'contrast')),
    lift: 0,
  }
  let last = null

  for (let pass = 0; pass < TARGET.passes; pass++) {
    last = await probe(input, lookChain(params, seed, trim))

    const ok =
      Math.abs(last.mean - TARGET.brightness) < 1.5 &&
      Math.abs(last.detail - targetDetail) < 0.4 &&
      Math.abs(last.sd - targetContrast) < 2
    if (ok) break

    params = {
      ...params,
      gamma: nextGamma(params.gamma, last.mean),
      // 細部が足りなければシャープを強め、出すぎていれば甘くする
      sharpen: Math.min(
        1.6,
        Math.max(-1.2, params.sharpen + (targetDetail - last.detail) * 0.35),
      ),
      // コントラストは標準偏差の比で寄せる
      contrast: Math.min(
        TARGET.contrastMax,
        Math.max(
          TARGET.contrastMin,
          params.contrast * (1 + (targetContrast - last.sd) / Math.max(12, last.sd) * 0.6),
        ),
      ),
    }
  }

  // コントラストを下げると明るさが上がる、というように 2 つの調整は互いに効く。
  // 同時に追うと明るさが行き過ぎるので、最後に明度だけで合わせ直す。
  // ガンマは効き方が素材によって大きく変わるため、ここでは効果が読める線形の補正を使う
  for (let pass = 0; pass < 3; pass++) {
    const gap = TARGET.brightness - last.mean
    if (Math.abs(gap) < 1.5) break
    params = {
      ...params,
      lift: Math.min(0.18, Math.max(-0.18, params.lift + (gap / 255) * 0.9)),
    }
    last = await probe(input, lookChain(params, seed, trim))
  }

  return { params, result: last }
}

/** エンコード設定も 1 か所に揃えておく */
export const ENCODE = [
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '25',
  '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-level', '3.0',
  '-movflags', '+faststart',
]
