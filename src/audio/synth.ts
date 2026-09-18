/**
 * 仮の音を Web Audio で合成する。音声ファイルが用意できたら
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

/**
 * 映写機の回転音。
 * 1 秒あたり pulses 回のコマ送り音（短い減衰ノイズ）を敷き詰めたループを作る。
 * 速さは playbackRate で変えられる。
 */
export function projectorBuffer(ctx: BaseAudioContext, pulses = 18, seconds = 1): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  const period = len / pulses
  // 継ぎ目が出ないよう、周期の整数倍ぶんだけ書き込む
  for (let p = 0; p < pulses; p++) {
    const start = Math.floor(p * period)
    const decay = Math.floor(period * 0.42)
    for (let i = 0; i < decay; i++) {
      const t = i / decay
      const env = Math.pow(1 - t, 3.2)
      const idx = start + i
      if (idx < len) data[idx] += (Math.random() * 2 - 1) * env * 0.9
    }
  }
  // 常時鳴っている機械のうなり
  for (let i = 0; i < len; i++) {
    data[i] += Math.sin((i / ctx.sampleRate) * Math.PI * 2 * 52) * 0.05
    data[i] = Math.max(-1, Math.min(1, data[i]))
  }
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

/** 一瞬の異音（映写機に混ざる軋み）。ループ回数が増えるほど耳につく */
export function creakBuffer(ctx: BaseAudioContext, seconds = 0.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const t = i / len
    const env = Math.sin(Math.PI * t) ** 2
    const wobble = Math.sin(t * 40 + Math.sin(t * 9) * 4)
    data[i] = (Math.random() * 2 - 1) * 0.25 * env * (0.5 + wobble * 0.5)
  }
  return buf
}
