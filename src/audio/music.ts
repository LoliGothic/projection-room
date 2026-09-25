/**
 * 仮のBGM。ショート動画によくある、当たり障りのない穏やかなループ。
 *
 * 音源ファイルが用意できるまでの代役だが、これ自体が仕掛けでもある。
 * 不穏タイマーが進むと、同じ曲のまま少しずつ音程が下がり、濁っていく。
 *
 * 音源を置いたときは engine 側がこれを使わずファイルを流す。
 */

/** 1小節の長さ（秒）。ゆったりめ */
const BAR_SEC = 3.2
/** どれだけ先まで予約しておくか */
const LOOKAHEAD_SEC = 0.9

/** Am - F - C - G。よくある進行 */
const CHORDS: readonly number[][] = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
]

/** 上に乗せる分散和音 */
const ARP_STEPS = [0, 2, 1, 2, 0, 1, 2, 1]

export interface Music {
  /** 0..1。上がるほど音程が下がり、濁る */
  setDread(intensity: number): void
  stop(): void
}

export function startMusic(ctx: AudioContext, destination: AudioNode): Music {
  const out = ctx.createGain()
  out.gain.value = 0.0001
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.2)

  // 不穏タイマーで曇らせるための一段
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 5200
  tone.Q.value = 0.6

  // 揺れ。強さが上がるとテープが伸びたように波打つ
  const wobble = ctx.createGain()
  wobble.gain.value = 1
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.9
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0
  lfo.connect(lfoGain).connect(wobble.gain)
  lfo.start()

  out.connect(tone).connect(wobble).connect(destination)

  let detune = 0
  let bar = 0
  let nextTime = ctx.currentTime + 0.15
  let timer = 0

  /** 1音鳴らす */
  const note = (
    freq: number,
    at: number,
    dur: number,
    level: number,
    type: OscillatorType = 'sine',
  ) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(level, at + Math.min(0.35, dur * 0.3))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g).connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  const scheduleBar = (at: number) => {
    const chord = CHORDS[bar % CHORDS.length]

    // パッド（和音を伸ばす）
    for (const f of chord) note(f / 2, at, BAR_SEC * 0.95, 0.045, 'triangle')

    // 分散和音
    const step = BAR_SEC / ARP_STEPS.length
    ARP_STEPS.forEach((idx, i) => {
      note(chord[idx] * 2, at + i * step, step * 0.9, 0.022, 'sine')
    })

    // 軽い拍。低めのサイン波を短く
    for (const beat of [0, 0.5]) {
      const bt = at + BAR_SEC * beat
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(110, bt)
      osc.frequency.exponentialRampToValueAtTime(48, bt + 0.12)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, bt)
      g.gain.exponentialRampToValueAtTime(0.05, bt + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, bt + 0.22)
      osc.connect(g).connect(out)
      osc.start(bt)
      osc.stop(bt + 0.25)
    }

    bar++
  }

  const pump = () => {
    while (nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      scheduleBar(nextTime)
      nextTime += BAR_SEC
    }
  }
  pump()
  timer = window.setInterval(pump, 400)

  return {
    setDread(intensity) {
      const t = ctx.currentTime
      // 半音ぶんまで下がる
      detune = -110 * intensity
      tone.frequency.setTargetAtTime(5200 - 4200 * intensity, t, 0.6)
      lfoGain.gain.setTargetAtTime(0.055 * intensity, t, 0.6)
      lfo.frequency.setTargetAtTime(0.9 + 1.6 * intensity, t, 0.6)
    },
    stop() {
      window.clearInterval(timer)
      out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25)
      lfo.stop(ctx.currentTime + 1)
    },
  }
}
