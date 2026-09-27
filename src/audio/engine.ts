import { noiseBuffer, rewindBuffer } from './synth'
import { startMusic, type Music } from './music'
import { BGM, STATIC, type BgmManifest, type BgmTrack } from '../config/audio'
import { bgmIndexAt } from '../core/bgmQueue'

/**
 * 音楽を流す場面。
 * - feed   フィードを見ているあいだ。投稿ごとの10秒ループ
 * - static ミス演出のあいだ。曲を切って砂嵐に差し替える
 * - off    起動画面・エンディング・記録など。音楽は鳴らさない
 */
export type MusicScene = 'feed' | 'static' | 'off'

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
  private bgmSrc: AudioBufferSourceNode | null = null
  /** 曲ごとの音量。重ねて差し替えるので、曲と一対一で持つ */
  private bgmSrcGain: GainNode | null = null
  private tracks: BgmTrack[] = []
  private trackIndex = -1
  /** 読み込み済みの曲。10秒ぶんなので何曲か抱えていても軽い */
  private buffers = new Map<string, AudioBuffer>()
  /**
   * 復号前の音源。
   * 復号には AudioContext が要り、それを作れるのは「はじめる」を押したあと。
   * 取ってくるだけなら先にできるので、ここに貯めておく。
   */
  private bytes = new Map<string, ArrayBuffer>()
  /** 読み込みの追い越しよけ。差し替えるたびに増やす */
  private loadToken = 0
  private loopStart = 0
  private loopEnd = 0
  /** 何回目の投稿か。一覧が届く前に来た指定もここに残して、あとから反映する */
  private turn = 0
  /** いま鳴らすべきもの。フィードの外では音楽を止める */
  private scene: MusicScene = 'off'
  /** いまの投稿の曲。場面が戻ったときはこれを鳴らし直す */
  private currentBuffer: AudioBuffer | null = null

  private staticSrc: AudioBufferSourceNode | null = null
  private staticGain: GainNode | null = null
  private staticLfo: OscillatorNode | null = null
  private rumbleSrc: OscillatorNode | null = null

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

    await this.prefetch()
    if (this.tracks.length > 0) {
      await this.applyTrack(true)
      return
    }
    // 一覧が読めないときの仮のBGM。場面が feed のときだけ鳴らす
    if (this.scene === 'feed') this.music = startMusic(ctx, gain)
  }

  /** 曲を読む。一度読めば使い回す */
  private async bufferFor(track: BgmTrack): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(track.id)
    if (cached) return cached
    const ctx = this.ctx
    if (!ctx) return null
    try {
      const bytes = await this.bytesFor(track)
      if (!bytes) return null
      // decodeAudioData は渡した領域を空にしてしまうので、写しを渡す
      const buffer = await ctx.decodeAudioData(bytes.slice(0))
      this.buffers.set(track.id, buffer)
      return buffer
    } catch {
      // 読めなければ無音のまま進む。音が出ないだけで遊べる
      return null
    }
  }

  /** 音源を取ってくる。AudioContext が無くても動く */
  private async bytesFor(track: BgmTrack): Promise<ArrayBuffer | null> {
    const cached = this.bytes.get(track.id)
    if (cached) return cached
    try {
      const url = import.meta.env.BASE_URL + track.src.replace(/^\.?\//, '')
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const bytes = await res.arrayBuffer()
      this.bytes.set(track.id, bytes)
      return bytes
    } catch {
      return null
    }
  }

  /**
   * 一覧と1本目の曲を先に取っておく。
   *
   * 「はじめる」を押してから取りに行くと、読み終わるまで音が始まらない。
   * 動画は先に回り出しているので、そのぶん1本目だけループがずれてしまう。
   * 音を鳴らすには操作が要るが、取ってくるだけなら先にできる。
   */
  async prefetch(): Promise<void> {
    if (this.tracks.length > 0) return
    const manifest = await loadManifest()
    this.tracks = manifest.tracks
    this.loopStart = manifest.loopStart
    this.loopEnd = manifest.loopEnd
    if (this.tracks.length === 0) return
    await this.bytesFor(this.tracks[bgmIndexAt(this.tracks.length, 0)])
  }

  /**
   * いまの turn に対応する曲を、動画と同じ周期で回し始める。
   * immediate なら音量を落とさずに始める（最初の一本）。
   */
  private async applyTrack(immediate = false) {
    if (this.tracks.length === 0) return
    const next = bgmIndexAt(this.tracks.length, this.turn)
    if (next === this.trackIndex) return
    this.trackIndex = next

    const token = ++this.loadToken
    const buffer = await this.bufferFor(this.tracks[next])
    // 読んでいるあいだに次の投稿へ送られていたら、こちらは捨てる
    if (!buffer || token !== this.loadToken) return

    this.currentBuffer = buffer
    if (this.scene === 'feed') {
      this.startLoop(buffer, immediate ? 0 : BGM.switchSec)
      this.applyDreadToMusic()
    }
    // 次の曲を先に読んでおく。送った瞬間に鳴り始めないと動画とずれる
    void this.bufferFor(this.tracks[bgmIndexAt(this.tracks.length, this.turn + 1)])
  }

  /**
   * ループを頭から回し始める。
   *
   * loopStart / loopEnd はサンプル単位で効くので、周期は 10.000 秒ちょうどになる。
   * 動画も送られた瞬間に頭出しされるので、二つのループは揃ったまま進む。
   *
   * 前の曲は止めずに重ねたまま消していく。止めてから始めると、消えるのを
   * 待つぶんだけ動画から遅れて回り始めてしまう。
   */
  private startLoop(buffer: AudioBuffer, fadeSec = 0) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const t = ctx.currentTime

    const prevSrc = this.bgmSrc
    const prevGain = this.bgmSrcGain
    if (prevSrc && prevGain) {
      prevGain.gain.cancelScheduledValues(t)
      prevGain.gain.setValueAtTime(prevGain.gain.value, t)
      prevGain.gain.linearRampToValueAtTime(0, t + fadeSec)
      prevSrc.stop(t + fadeSec + 0.02)
    }

    const gain = ctx.createGain()
    gain.gain.value = fadeSec > 0 ? 0 : 1
    if (fadeSec > 0) gain.gain.linearRampToValueAtTime(1, t + fadeSec)
    gain.connect(this.musicGain)

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.loopStart = this.loopStart
    src.loopEnd = this.loopEnd
    // 速度を落とすと音程も下がる。テープが伸びたように聞こえる
    src.playbackRate.value = 1 - this.dread * 0.12
    src.connect(gain)
    src.start(t, this.loopStart)
    this.bgmSrc = src
    this.bgmSrcGain = gain
  }

  /** 鳴らしているループを消す */
  private stopLoop(fadeSec: number) {
    const ctx = this.ctx
    const src = this.bgmSrc
    const gain = this.bgmSrcGain
    this.bgmSrc = null
    this.bgmSrcGain = null
    if (!ctx || !src || !gain) return
    const t = ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0, t + fadeSec)
    src.stop(t + fadeSec + 0.02)
  }

  /**
   * ミス演出のあいだ流す砂嵐。
   * 帯域の中心をゆっくり上下させて、受信が乱れているように聞かせる。
   */
  private startStatic() {
    const ctx = this.ctx
    if (!ctx || !this.musicGain || this.staticSrc) return
    const t = ctx.currentTime

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(STATIC.gain, t + STATIC.fadeSec)
    gain.connect(this.musicGain)

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = STATIC.centerHz
    band.Q.value = 0.6
    band.connect(gain)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = STATIC.sweepRate
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = STATIC.sweepHz
    lfo.connect(lfoDepth).connect(band.frequency)
    lfo.start(t)

    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 2)
    src.loop = true
    src.connect(band)
    src.start(t)

    // 下に敷く低いうなり
    const rumble = ctx.createOscillator()
    rumble.type = 'sawtooth'
    rumble.frequency.value = 48
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 200
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.value = STATIC.rumbleGain
    rumble.connect(lp).connect(rumbleGain).connect(gain)
    rumble.start(t)

    this.staticSrc = src
    this.staticGain = gain
    this.staticLfo = lfo
    this.rumbleSrc = rumble
  }

  private stopStatic(fadeSec: number = STATIC.fadeSec) {
    const ctx = this.ctx
    const src = this.staticSrc
    const gain = this.staticGain
    const lfo = this.staticLfo
    const rumble = this.rumbleSrc
    this.staticSrc = null
    this.staticGain = null
    this.staticLfo = null
    this.rumbleSrc = null
    if (!ctx || !src || !gain) return
    const t = ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0, t + fadeSec)
    const at = t + fadeSec + 0.02
    src.stop(at)
    lfo?.stop(at)
    rumble?.stop(at)
  }

  /**
   * いま鳴らすものを切り替える。
   *
   * フィードを離れたら音楽は止める。起動画面やエンディングまで曲が続くと、
   * ゲームが終わったのかどうか分からなくなる。
   */
  setScene(scene: MusicScene) {
    if (scene === this.scene) return
    this.scene = scene

    if (scene === 'feed') {
      this.stopStatic()
      if (this.currentBuffer) {
        this.startLoop(this.currentBuffer, BGM.switchSec)
        this.applyDreadToMusic()
      } else if (this.tracks.length === 0 && this.ctx && this.musicGain && !this.music) {
        this.music = startMusic(this.ctx, this.musicGain)
      }
      return
    }

    // 画面が壊れる瞬間は、曲も断ち切れたように消す
    this.stopLoop(scene === 'static' ? 0 : BGM.switchSec)
    this.music?.stop()
    this.music = null
    if (scene === 'static') this.startStatic()
    else this.stopStatic()
  }

  /** 投稿が変わったことを伝える。曲もここで変わる */
  setTurn(turn: number) {
    if (turn === this.turn) return
    this.turn = turn
    void this.applyTrack()
  }

  /** 映像を頭出ししたとき。音楽も同じところへ戻して、ずれないようにする */
  restartLoop() {
    if (this.scene !== 'feed') return
    const buffer = this.bgmSrc?.buffer
    if (buffer) this.startLoop(buffer)
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
    /*
      速度を落とすと音程も下がる。テープが伸びたように聞こえる。
      同時に、動画の10秒ループから音楽が少しずつ遅れていく。
      揃っていたものがずれていくこと自体を、時間が経った合図にしている。
    */
    this.bgmSrc?.playbackRate.setTargetAtTime(1 - this.dread * 0.12, t, 0.8)
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
    this.bgmSrc?.stop()
    this.bgmSrc = null
    this.bgmSrcGain = null
    this.currentBuffer = null
    this.buffers.clear()
    this.bytes.clear()
    this.stopStatic(0)
    this.scene = 'off'
    this.trackIndex = -1
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}

export const audio = new AudioEngine()

const NO_BGM: BgmManifest = { version: 0, loopStart: 0, loopEnd: 0, tracks: [] }

/** 曲の一覧を読む。読めなければ合成BGMに落ちるだけなので、失敗しても構わない */
async function loadManifest(): Promise<BgmManifest> {
  try {
    const url = import.meta.env.BASE_URL + BGM.manifest.replace(/^\.?\//, '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as BgmManifest
    if (!Array.isArray(data.tracks) || !(data.loopEnd > data.loopStart)) return NO_BGM
    return { ...data, tracks: data.tracks.filter((t) => t?.id && t?.src) }
  } catch {
    return NO_BGM
  }
}
