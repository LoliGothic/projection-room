import { describe, expect, it } from 'vitest'
import type { Clip } from './types'
import { seededRng } from './rng'
import { createSession, currentClip, preloadClips, reduce, type Session } from './session'
import { RULES } from '../config/tuning'

function makePool(): Clip[] {
  const out: Clip[] = []
  for (let i = 0; i < 12; i++) {
    out.push({
      id: `r${i}`,
      src: `clips/r${i}.mp4`,
      isAI: false,
      category: `cat-${Math.floor(i / 2)}`,
    })
    out.push({
      id: `a${i}`,
      src: `clips/a${i}.mp4`,
      isAI: true,
      category: `cat-${Math.floor(i / 2)}`,
    })
  }
  return out
}

const rng = seededRng(1234)
const send = (s: Session, e: Parameters<typeof reduce>[1]) => reduce(s, e, rng)

/** いま出題中の 1 本に正解する */
function answerCorrectly(s: Session): Session {
  const clip = currentClip(s)!
  return send(s, { type: 'answer', verdict: clip.isAI ? 'report' : 'keep' })
}

/** いま出題中の 1 本を間違える */
function answerWrongly(s: Session): Session {
  const clip = currentClip(s)!
  return send(s, { type: 'answer', verdict: clip.isAI ? 'keep' : 'report' })
}

/** リセット演出を飛ばして playing に戻す */
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
  it('起動画面から始まり、はじめるとフィードに入る', () => {
    const s = createSession(makePool())
    expect(s.phase.name).toBe('launch')

    const afterStart = send(s, { type: 'start' })
    expect(afterStart.phase.name).toBe('playing')
    expect(afterStart.progress.stage).toBe(1)
  })

  it('開始時に先読み分まで用意されている', () => {
    const s = started()
    expect(currentClip(s)).toBeDefined()
    expect(preloadClips(s)).toHaveLength(RULES.preloadAhead)
  })

  it('回答すると間を置かず次の動画に進み、先読みも補充される', () => {
    const s = started()
    const first = currentClip(s)!
    const next = answerCorrectly(s)

    expect(next.phase.name).toBe('playing')
    expect(currentClip(next)!.id).not.toBe(first.id)
    expect(preloadClips(next)).toHaveLength(RULES.preloadAhead)
  })

  it('先読みしていた動画が、そのまま次の1本になる', () => {
    const s = started()
    const expected = preloadClips(s)[0].id
    expect(currentClip(answerCorrectly(s))!.id).toBe(expected)
  })

  it(`${RULES.clipsPerStage} 本正解すると次の段階へ進む`, () => {
    let s = started()
    for (let i = 0; i < RULES.clipsPerStage; i++) s = answerCorrectly(s)
    expect(s.phase.name).toBe('playing')
    expect(s.progress.stage).toBe(2)
  })

  it('ミスするとリセット演出に入り、第1段階に戻る', () => {
    let s = started()
    for (let i = 0; i < RULES.clipsPerStage; i++) s = answerCorrectly(s)
    expect(s.progress.stage).toBe(2)

    s = answerWrongly(s)
    expect(s.phase.name).toBe('resetting')
    expect(s.progress.stage).toBe(1)

    s = send(s, { type: 'cutsceneDone' })
    expect(s.phase.name).toBe('playing')
  })

  it('リセット演出中は次の1本へ進めない（演出の裏に次の問題が映らない）', () => {
    const s = started()
    const answered = currentClip(s)!

    const cut = answerWrongly(s)
    expect(cut.phase.name).toBe('resetting')
    expect(currentClip(cut)!.id).toBe(answered.id)

    const after = send(cut, { type: 'cutsceneDone' })
    expect(after.phase.name).toBe('playing')
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

  it('リプレイは回数を数えるだけで、出題も段階も変わらない', () => {
    const s = started()
    const replayed = send(send(s, { type: 'replay' }), { type: 'replay' })
    expect(replayed.progress.stats.replays).toBe(2)
    expect(currentClip(replayed)!.id).toBe(currentClip(s)!.id)
    expect(replayed.progress.stage).toBe(1)
  })

  it('一度もループせずに全8段階を通過すると撮影者エンドになる', () => {
    let s = started()
    for (let i = 0; i < RULES.totalStages * RULES.clipsPerStage; i++) {
      s = skipCutscenes(answerCorrectly(s))
    }
    expect(s.phase).toEqual({ name: 'ending', endingId: 'true' })
    expect(s.progress.stats.loops).toBe(0)
  })

  it('ループを挟んで通過すると通常エンドになる', () => {
    let s = skipCutscenes(answerWrongly(started()))
    for (let i = 0; i < RULES.totalStages * RULES.clipsPerStage; i++) {
      s = skipCutscenes(answerCorrectly(s))
    }
    expect(s.phase).toEqual({ name: 'ending', endingId: 'closed' })
    expect(s.progress.stats.loops).toBe(1)
  })

  it('不穏タイマーを使い切ると、第1段階に戻らず暗転エンドで終わる', () => {
    const s = send(started(), { type: 'darkness' })
    expect(s.phase).toEqual({ name: 'ending', endingId: 'blackout' })
    expect(s.progress.stats.wentDark).toBe(true)
  })

  it('プレイ中でなければ回答もリプレイも無視する', () => {
    const s = createSession(makePool()) // 起動画面
    expect(send(s, { type: 'answer', verdict: 'report' })).toBe(s)
    expect(send(s, { type: 'replay' })).toBe(s)
    expect(send(s, { type: 'darkness' })).toBe(s)
  })
})
