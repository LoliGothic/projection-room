import { rewindBuffer } from './synth'
import { startMusic, type Music } from './music'
import { BGM, type BgmManifest, type BgmTrack } from '../config/audio'
import { bgmIndexAt } from '../core/bgmQueue'

/**
 * ゲームの音。動画は常に無音で、音はすべてここで鳴らす。
 * - BGM。投稿が変わるたびに曲も変わる
 * - 通知音、タップ音、正解・ミスの音、リセット時の読み込み音
 *
 * 不穏タイマーが進んでも音を足しはしない。BGM の速度と音量が落ちるだけで、
 * ふつうのアプリが壊れていくように見せる。低い唸りや軋みを重ねると、
 * 「そういう演出のゲーム」だと最初から分かってしまう。
 *
 * スマホの制限があるので、起動画面の「はじめる」で unlock() を呼ぶまで音は出ない。
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  private music: Music | null = null
  private musicGain: GainNode | null = null
  private bgmEl: HTMLAudioElement | null = null
  private bgmNode: MediaElementAudioSourceNode | null = null
  private tracks: BgmTrack[] = []
  private trackIndex = -1
  /** 何回目の投稿か。一覧が届く前に来た指定もここに残して、あとから反映する */
  private turn = 0

  private rewind: AudioBuffer | null = null

  private volume = 0.7
  private muted = false
  private dread = 0

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

    this.rewind = rewindBuffer(ctx)
    await this.startBgm(ctx, master)
  }

  /**
   * BGM を始める。
   * 音源の一覧が読めればそこから流し、読めなければ合成した仮のBGMを鳴らす。
   */
  private async startBgm(ctx: AudioContext, master: GainNode) {
    const gain = ctx.createGain()
    gain.gain.value = BGM.gain
    gain.connect(master)
    this.musicGain = gain

    this.tracks = await loadTracks()
    if (this.tracks.length > 0) {
      /*
        <audio> 越しに流す。decodeAudioData だと曲まるごとメモリに展開するので、
        投稿ごとに切り替える作りには重すぎる。
        別の場所から配信する場合に音が消えないよう crossOrigin を付けておく。
      */
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.loop = true
      el.preload = 'auto'
      // 再生速度を落としたときに音程も下がる。テープが伸びたように聞こえる
      el.preservesPitch = false
      this.bgmEl = el
      this.bgmNode = ctx.createMediaElementSource(el)
      this.bgmNode.connect(gain)
      this.applyTrack(true)
      return
    }
    this.music = startMusic(ctx, gain)
  }

  /** いまの turn に対応する曲へ移る。immediate なら音量を落とさずに始める */
  private applyTrack(immediate = false) {
    const el = this.bgmEl
    if (!el || this.tracks.length === 0) return
    const next = bgmIndexAt(this.tracks.length, this.turn)
    if (next === this.trackIndex) return
    this.trackIndex = next

    const src = import.meta.env.BASE_URL + this.tracks[next].src.replace(/^\.?\//, '')
    const start = () => {
      el.src = src
      el.currentTime = 0
      void el.play().catch(() => {
        /* 端末が拒んでも他の音は鳴っているので、そのままにする */
      })
    }

    if (immediate || !this.ctx || !this.musicGain) {
      start()
      return
    }
    // 切り替えの段差を消すため、いったん絞ってから差し替える
    const t = this.ctx.currentTime
    this.musicGain.gain.setTargetAtTime(0, t, BGM.switchSec / 3)
    window.setTimeout(() => {
      start()
      this.applyDreadToMusic()
    }, BGM.switchSec * 1000)
  }

  /** 投稿が変わったことを伝える。曲もここで変わる */
  setTurn(turn: number) {
    if (turn === this.turn) return
    this.turn = turn
    this.applyTrack()
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
  setDread(intensity: number) {
    if (!this.ctx) return
    this.dread = intensity
    this.music?.setDread(intensity)
    this.applyDreadToMusic()
  }

  /**
   * 不穏の度合いを BGM に反映する。
   * 曲を切り替えたあとにも呼ぶので、setDread とは分けてある。
   */
  private applyDreadToMusic() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // 音源ファイルのときは再生速度を落とす
    if (this.bgmEl) this.bgmEl.playbackRate = 1 - this.dread * 0.12
    // 不穏になるほど BGM は引っ込み、環境音が前に出る
    this.musicGain?.gain.setTargetAtTime(BGM.gain * (1 - this.dread * 0.45), t, 0.8)
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

  /**
   * 画面が壊れるときの音。
   * 読み込み音だと通信待ちに聞こえるので、割れたノイズと低い唸りを重ねる。
   */
  playGlitch() {
    this.play(this.rewind, 0.5, 0, 1.6)
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(92, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 1.1)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    osc.connect(gain).connect(lp).connect(this.master)
    osc.start(t)
    osc.stop(t + 1.25)
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
    this.music?.stop()
    this.music = null
    this.bgmEl?.pause()
    this.bgmEl = null
    this.bgmNode = null
    this.trackIndex = -1
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}

export const audio = new AudioEngine()

/** 曲の一覧を読む。無ければ空。合成BGMに落ちるだけなので失敗しても構わない */
async function loadTracks(): Promise<BgmTrack[]> {
  try {
    const url = import.meta.env.BASE_URL + BGM.manifest.replace(/^\.?\//, '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as BgmManifest
    return Array.isArray(data.tracks) ? data.tracks.filter((t) => t?.src) : []
  } catch {
    return []
  }
}
