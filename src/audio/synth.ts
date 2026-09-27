/**
 * 効果音を Web Audio で合成する。音声ファイルが用意できたら
 * ここの関数だけ差し替えれば engine.ts は触らずに済む。
 */

/** ホワイトノイズのループ用バッファ */
export function noiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** 巻き戻し：高速で逆回転する音 */
export function rewindBuffer(ctx: BaseAudioContext, seconds = 1.1): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const t = i / len
    // だんだん速くなるコマ音
    const rate = 40 + t * 120
    const phase = (i / ctx.sampleRate) * rate
    const tick = Math.pow(1 - (phase % 1), 6)
    const env = t < 0.85 ? 1 : (1 - t) / 0.15
    data[i] = (Math.random() * 2 - 1) * tick * env * 0.8
  }
  return buf
}
