import { beforeEach, describe, expect, it } from 'vitest'
import { clearSeenFrames, pushSeenFrame, seenFrames } from './seenFrames'

const frame = (n: number) => `data:image/jpeg;base64,${n}`

describe('seenFrames', () => {
  beforeEach(() => clearSeenFrames())

  it('送った順に貯まる', () => {
    pushSeenFrame(frame(1))
    pushSeenFrame(frame(2))
    expect(seenFrames()).toEqual([frame(1), frame(2)])
  })

  it('取れなかったコマは数えない', () => {
    pushSeenFrame(null)
    pushSeenFrame(frame(1))
    pushSeenFrame(null)
    expect(seenFrames()).toEqual([frame(1)])
  })

  it('貯めすぎず、新しいほうを残す', () => {
    for (let i = 0; i < 30; i++) pushSeenFrame(frame(i))
    const kept = seenFrames()
    expect(kept.length).toBeLessThanOrEqual(12)
    expect(kept[kept.length - 1]).toBe(frame(29))
  })

  it('片付けると空になる', () => {
    pushSeenFrame(frame(1))
    clearSeenFrames()
    expect(seenFrames()).toEqual([])
  })
})
