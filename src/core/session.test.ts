import { describe, expect, it } from 'vitest'
import type { Clip } from './types'
import { seededRng } from './rng'
import { createSession, currentClip, preloadClips, reduce, type Session } from './session'
import { RULES } from '../config/tuning'

function makePool(): Clip[] {
  const out: Clip[] = []
  for (let i = 0; i < 12; i++) {
    out.push({ id: `r${i}`, src: `clips/r${i}.mp4`, isAI: false, work: `w${Math.floor(i / 2)}` })
    out.push({ id: `a${i}`, src: `clips/a${i}.mp4`, isAI: true, work: `g${Math.floor(i / 2)}` })
  }
  return out
}

const rng = seededRng(1234)
const send = (s: Session, e: Parameters<typeof reduce>[1]) => reduce(s, e, rng)

/** いま出題中の 1 本に正解する */
function answerCorrectly(s: Session): Session {
  const clip = currentClip(s)!
  return send(s, { type: 'answer', verdict: clip.isAI ? 'burn' : 'project' })
}

/** いま出題中の 1 本を間違える */
function answerWrongly(s: Session): Session {
  const clip = currentClip(s)!
  return send(s, { type: 'answer', verdict: clip.isAI ? 'project' : 'burn' })
}

/** 字幕カードなどの演出を飛ばして playing に戻す */
function skipCutscenes(s: Session): Session {
  let cur = s
  for (let i = 0; i < 4 && cur.phase.name !== 'playing'; i++) {
    cur = send(cur, { type: 'cutsceneDone' })
  }
  return cur
}

function started(): Session {
  return skipCutscenes(send(createSession(makePool()), { type: 'start' }))
}

describe('session', () => {
  it('タイトルから始まり、字幕カードを挟んでプレイに入る', () => {
    const s = createSession(makePool())
    expect(s.phase.name).toBe('title')

    const afterStart = send(s, { type: 'start' })
    expect(afterStart.phase).toMatchObject({ name: 'intertitle', reel: 1 })

    expect(send(afterStart, { type: 'cutsceneDone' }).phase.name).toBe('playing')
  })

  it('開始時に先読み分まで用意されている', () => {
    const s = started()
    expect(currentClip(s)).toBeDefined()
    expect(preloadClips(s)).toHaveLength(RULES.preloadAhead)
  })

  it('回答すると次の動画に進み、先読みも補充される', () => {
    const s = started()
    const first = currentClip(s)!
    const next = answerCorrectly(s)

    // 1巻1本なら巻の節目（字幕カード）、複数本なら続けてプレイ
    expect(['playing', 'intertitle']).toContain(next.phase.name)
    expect(currentClip(next)!.id).not.toBe(first.id)
    expect(preloadClips(next)).toHaveLength(RULES.preloadAhead)
  })

  it('先読みしていた動画が、そのまま次の1本になる', () => {
    const s = started()
    const expected = preloadClips(s)[0].id
    expect(currentClip(answerCorrectly(s))!.id).toBe(expected)
  })

  it(`${RULES.clipsPerReel} 本正解すると字幕カードを挟んで次の巻へ進む`, () => {
    let s = started()
    for (let i = 0; i < RULES.clipsPerReel - 1; i++) s = answerCorrectly(s)
    s = answerCorrectly(s)
    expect(s.phase).toMatchObject({ name: 'intertitle', reel: 2 })
    expect(skipCutscenes(s).progress.reel).toBe(2)
  })

  it('ミスするとループ演出に入り、第1巻の字幕カードに戻る', () => {
    let s = started()
    for (let i = 0; i < RULES.clipsPerReel; i++) s = answerCorrectly(s)
    s = skipCutscenes(s)
    expect(s.progress.reel).toBe(2)

    s = answerWrongly(s)
    expect(s.phase.name).toBe('loopCut')

    s = send(s, { type: 'cutsceneDone' })
    expect(s.phase).toMatchObject({ name: 'intertitle', reel: 1 })
    expect(s.progress.reel).toBe(1)
  })

  it('ミスの演出中は次の1本へ進めない（演出の下に次の問題が映らない）', () => {
    const s = started()
    const answered = currentClip(s)!

    const cut = answerWrongly(s)
    expect(cut.phase.name).toBe('loopCut')
    // まだ進んでいない。焦げるのは、いま間違えたフィルム
    expect(currentClip(cut)!.id).toBe(answered.id)

    const after = send(cut, { type: 'cutsceneDone' })
    expect(after.phase).toMatchObject({ name: 'intertitle', reel: 1 })
    expect(currentClip(after)!.id).not.toBe(answered.id)
    expect(preloadClips(after)).toHaveLength(RULES.preloadAhead)
  })

  it('ループしても出題済みはリセットされない（同じ動画が続けて出ない）', () => {
    let s = started()
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) {
      seen.add(currentClip(s)!.id)
      s = skipCutscenes(i % 4 === 3 ? answerWrongly(s) : answerCorrectly(s))
    }
    expect(seen.size).toBe(20)
  })

  it('リプレイは回数を数えるだけで、出題も巻も変わらない', () => {
    const s = started()
    const replayed = send(send(s, { type: 'replay' }), { type: 'replay' })
    expect(replayed.progress.stats.replays).toBe(2)
    expect(currentClip(replayed)!.id).toBe(currentClip(s)!.id)
    expect(replayed.progress.reel).toBe(1)
  })

  it('一度もループせずに全8巻を通過すると真エンドになる', () => {
    let s = started()
    for (let i = 0; i < RULES.totalReels * RULES.clipsPerReel; i++) {
      s = skipCutscenes(answerCorrectly(s))
    }
    expect(s.phase).toEqual({ name: 'ending', endingId: 'true' })
    expect(s.progress.stats.loops).toBe(0)
  })

  it('ループを挟んで通過すると夜明けエンドになる', () => {
    let s = skipCutscenes(answerWrongly(started()))
    for (let i = 0; i < RULES.totalReels * RULES.clipsPerReel; i++) {
      s = skipCutscenes(answerCorrectly(s))
    }
    expect(s.phase).toEqual({ name: 'ending', endingId: 'dawn' })
    expect(s.progress.stats.loops).toBe(1)
  })

  it('不穏タイマーを使い切ると、第1巻に戻らず暗闇エンドで終わる', () => {
    const s = send(started(), { type: 'darkness' })
    expect(s.phase).toEqual({ name: 'ending', endingId: 'darkness' })
    expect(s.progress.stats.wentDark).toBe(true)
  })

  it('プレイ中でなければ回答もリプレイも無視する', () => {
    const s = send(createSession(makePool()), { type: 'start' }) // intertitle
    expect(send(s, { type: 'answer', verdict: 'burn' })).toBe(s)
    expect(send(s, { type: 'replay' })).toBe(s)
    expect(send(s, { type: 'darkness' })).toBe(s)
  })
})
