import { creakBuffer, noiseBuffer, projectorBuffer, rewindBuffer } from './synth'

/**
 * ゲームの音。動画は常に無音で、音はすべてここで鳴らす。
 * - 低い環境音を常時鳴らし、不穏タイマーの段階で大きく・重くする
 * - 通知音、スワイプ音、ミス時の違和感のある音、リセット時の読み込み音
 * - ループ回数に応じて環境音に軋みが混ざる
 *
 * スマホの制限があるので、起動画面の「はじめる」で unlock() を呼ぶまで音は出ない。
 * 音声ファイルを用意したら synth.ts の生成関数を差し替えるだけでよい。
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  private projectorSrc: AudioBufferSourceNode | null = null
  private projectorGain: GainNode | null = null
  private projectorFilter: BiquadFilterNode | null = null

  private droneGain: GainNode | null = null
  private droneOscs: OscillatorNode[] = []

  private breathSrc: AudioBufferSourceNode | null = null
  private breathGain: GainNode | null = null

  private creak: AudioBuffer | null = null
  private rewind: AudioBuffer | null = null
  private creakTimer: number | null = null
  private loops = 0

  private volume = 0.7
  private muted = false

  get ready(): boolean {
    return this.ctx !== null
  }

  /** ユーザー操作の中から呼ぶこと */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    const master = ctx.createGain()
    master.gain.value = this.muted ? 0 : this.volume
    master.connect(ctx.destination)
    this.master = master

    this.creak = creakBuffer(ctx)
    this.rewind = rewindBuffer(ctx)

    this.startProjector(ctx, master)
    this.startDrone(ctx, master)
    this.startBreath(ctx, master)
    this.scheduleCreak()
  }

  private startProjector(ctx: AudioContext, master: GainNode) {
    const src = ctx.createBufferSource()
    src.buffer = projectorBuffer(ctx)
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 900
    filter.Q.value = 0.7

    const gain = ctx.createGain()
    gain.gain.value = 0.22

    src.connect(filter).connect(gain).connect(master)
    src.start()

    this.projectorSrc = src
    this.projectorGain = gain
    this.projectorFilter = filter
  }

  private startDrone(ctx: AudioContext, master: GainNode) {
    const gain = ctx.createGain()
    gain.gain.value = 0.08

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220

    gain.connect(lp).connect(master)

    for (const freq of [43.5, 44.2, 65.4]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = ctx.createGain()
      g.gain.value = freq > 60 ? 0.35 : 1
      osc.connect(g).connect(gain)
      osc.start()
      this.droneOscs.push(osc)
    }
    this.droneGain = gain
  }

  private startBreath(ctx: AudioContext, master: GainNode) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 3)
    src.loop = true

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 420
    bp.Q.value = 1.4

    const gain = ctx.createGain()
    gain.gain.value = 0

    // ゆっくりした吸って吐く
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.22
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.55
    lfo.connect(lfoGain).connect(gain.gain)
    lfo.start()

    src.connect(bp).connect(gain).connect(master)
    src.start()

    this.breathSrc = src
    this.breathGain = gain
  }

  /* ---- 状態の反映 ---- */

  setVolume(volume: number) {
    this.volume = volume
    this.applyMaster()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.applyMaster()
  }

  private applyMaster() {
    if (!this.ctx || !this.master) return
    const target = this.muted ? 0 : this.volume
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05)
  }

  /** 不穏タイマーの段階を反映する */
  setDread(intensity: number, ambience: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    if (this.projectorSrc) {
      // だんだん重く、うねるように
      this.projectorSrc.playbackRate.setTargetAtTime(1 - intensity * 0.35, t, 0.4)
    }
    this.projectorFilter?.frequency.setTargetAtTime(900 - intensity * 420, t, 0.4)
    this.projectorGain?.gain.setTargetAtTime(0.22 + intensity * 0.1, t, 0.3)
    this.droneGain?.gain.setTargetAtTime(0.08 + intensity * 0.16, t, 0.5)
    this.breathGain?.gain.setTargetAtTime(ambience * 0.2, t, 0.5)
  }

  /** ループ回数。増えるほど映写機の異音が増える */
  setLoops(loops: number) {
    this.loops = loops
  }

  /** ミスの演出などで、環境音を一瞬止める */
  setAmbienceRunning(running: boolean) {
    if (!this.ctx || !this.projectorGain) return
    const t = this.ctx.currentTime
    this.projectorGain.gain.setTargetAtTime(running ? 0.22 : 0, t, running ? 0.12 : 0.04)
  }

  private scheduleCreak() {
    if (this.creakTimer !== null) window.clearTimeout(this.creakTimer)
    // ループが増えるほど間隔が短くなる
    const base = 26_000 - Math.min(20_000, this.loops * 900)
    const wait = base * (0.6 + Math.random() * 0.8)
    this.creakTimer = window.setTimeout(() => {
      if (this.loops > 0) this.play(this.creak, 0.55, (Math.random() - 0.5) * 1.4)
      this.scheduleCreak()
    }, wait)
  }

  /* ---- 効果音 ---- */

  private play(buffer: AudioBuffer | null, gainValue: number, pan = 0, rate = 1) {
    if (!this.ctx || !this.master || !buffer) return
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const gain = this.ctx.createGain()
    gain.gain.value = gainValue
    const panner = this.ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    src.connect(gain).connect(panner).connect(this.master)
    src.start()
  }

  /** 通知音。短い二音 */
  playNotify() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    for (const [i, freq] of [1046, 1568].entries()) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = this.ctx.createGain()
      const at = t + i * 0.09
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.05, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      osc.connect(gain).connect(this.master)
      osc.start(at)
      osc.stop(at + 0.2)
    }
  }

  /** 飾りのボタンを押したときの、軽いタップ音 */
  playTap() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, t)
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.06)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  /** 正解：小さな確かな音。pan は回答方向（右＝残す、左＝報告） */
  playCorrect(pan = 0) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.09)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    const panner = this.ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    osc.connect(gain).connect(panner).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  /** ミス：不協和音 */
  playMiss(pan = 0) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const panner = this.ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    panner.connect(this.master)
    for (const [freq, level] of [
      [146.8, 0.09],
      [155.6, 0.09],
      [207.7, 0.06],
    ] as const) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + 0.8)
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(level, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1400
      osc.connect(gain).connect(lp).connect(panner)
      osc.start(t)
      osc.stop(t + 0.95)
    }
  }

  /** おすすめのリセット中に流れる、読み込み音 */
  playLoading() {
    this.play(this.rewind, 0.45)
  }

  /**
   * 画面が隠れたら音を止める。
   * ホームボタンで戻ったりタブを切り替えたとき、AudioContext は
   * 勝手には止まらないので明示的に止める必要がある。
   */
  async setHidden(hidden: boolean): Promise<void> {
    const ctx = this.ctx
    if (!ctx) return
    try {
      if (hidden) {
        if (ctx.state === 'running') await ctx.suspend()
      } else if (ctx.state === 'suspended') {
        await ctx.resume()
      }
    } catch {
      /* 端末側の都合で失敗しても遊べるので握りつぶす */
    }
  }

  /** 画面を離れるときなど */
  dispose() {
    if (this.creakTimer !== null) window.clearTimeout(this.creakTimer)
    this.creakTimer = null
    this.projectorSrc?.stop()
    this.breathSrc?.stop()
    for (const osc of this.droneOscs) osc.stop()
    this.droneOscs = []
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}

export const audio = new AudioEngine()
