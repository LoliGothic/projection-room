// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { RULES } from './config/tuning'
import type { ClipsFile } from './core/types'
import { EMPTY_RECORDS } from './core/records'
import { useGame } from './state/gameStore'
import { useRecords } from './state/recordsStore'
import { DEFAULT_SETTINGS, useSettings } from './state/settingsStore'

const CATEGORIES = ['自然・風景', '動物', '街', '食べ物', '空']

/** 本物10本 / AI10本。カテゴリは両者で共通にして手がかりにしない */
const clipsFile: ClipsFile = {
  version: 1,
  clips: Array.from({ length: 20 }, (_, i) => ({
    id: `c${i}`,
    src: `clips/c${i}.mp4`,
    isAI: i % 2 === 1,
    category: CATEGORIES[Math.floor(i / 2) % CATEGORIES.length],
    scene: `場面${i}`,
    contributor: `user_${i}`,
    tool: i % 2 === 1 ? '仮・生成ツール' : undefined,
    note: 'メモ',
  })),
}

beforeEach(() => {
  window.localStorage.clear()
  useSettings.setState(DEFAULT_SETTINGS)
  useRecords.setState({ records: EMPTY_RECORDS, saveFailed: false })
  useGame.setState({ session: null, error: null })
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clipsFile) }),
    ),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** いま映っている動画の clips.json 上の定義 */
function activeClip() {
  const shown = [...document.querySelectorAll('.swipe-card video')].find(
    (v) => (v as HTMLElement).style.opacity === '1',
  )
  const src = shown?.getAttribute('src') ?? ''
  return clipsFile.clips.find((c) => src.endsWith(`${c.id}.mp4`))
}

/** 正しく / わざと間違えて回答する */
async function answer(correct: boolean) {
  const clip = activeClip()
  if (!clip) throw new Error('映っている動画が見つかりません')
  const report = correct ? clip.isAI : !clip.isAI
  await act(async () => {
    fireEvent.keyDown(window, { key: report ? 'ArrowLeft' : 'ArrowRight' })
  })
}

async function toFeed() {
  render(<App />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'はじめる' })).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'はじめる' }))
  await waitFor(() => expect(document.querySelector('.swipe-card video')).toBeTruthy())
}

describe('フィードが動く', () => {
  it('起動画面から「はじめる」でフィードに入る', async () => {
    await toFeed()
    expect(activeClip()).toBeDefined()
    expect(document.querySelector('.verdict.report')?.textContent).toBe('報告')
    expect(document.querySelector('.verdict.keep')?.textContent).toBe('残す')
  })

  it('先読み用の <video> が current + preload ぶん並んでいる', async () => {
    await toFeed()
    expect(document.querySelectorAll('.swipe-card video')).toHaveLength(RULES.preloadAhead + 1)
  })

  it('先読み用の <video> は重ねて配置されている', async () => {
    await toFeed()
    for (const v of document.querySelectorAll('.swipe-card video')) {
      const style = (v as HTMLElement).style
      expect(style.position).toBe('absolute')
      expect(style.inset).toBe('0px')
    }
  })

  it('矢印キーで回答すると次の動画に進む', async () => {
    await toFeed()
    const before = activeClip()!.id
    await answer(true)
    await waitFor(() => expect(activeClip()!.id).not.toBe(before))
  })

  it('指でのドラッグ（ポインタ操作）で回答できる', async () => {
    await toFeed()
    const clip = activeClip()!
    const card = document.querySelector('.swipe-card') as HTMLElement
    const dir = clip.isAI ? -1 : 1
    await act(async () => {
      fireEvent.pointerDown(card, { pointerId: 1, clientX: 200, clientY: 300 })
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 200 + dir * 40, clientY: 302 })
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 200 + dir * 140, clientY: 304 })
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 200 + dir * 140, clientY: 304 })
    })
    await waitFor(() => expect(activeClip()!.id).not.toBe(clip.id))
  })

  it('途中で操作を横取りされたら（pointercancel）回答しない', async () => {
    await toFeed()
    const before = activeClip()!.id
    const card = document.querySelector('.swipe-card') as HTMLElement
    await act(async () => {
      fireEvent.pointerDown(card, { pointerId: 1, clientX: 200, clientY: 300 })
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 340, clientY: 300 })
      fireEvent.pointerCancel(card, { pointerId: 1, clientX: 340, clientY: 300 })
    })
    expect(activeClip()!.id).toBe(before)
  })

  it('ミスするとリセット演出が出て、その裏に次の動画は見えない', async () => {
    await toFeed()
    const wrong = activeClip()!.id
    await answer(false)

    expect(document.querySelector('.resetting')).toBeTruthy()
    expect(activeClip()!.id).toBe(wrong)
  })

  it('リセット演出は 固まる → 読み込み中 → 通知 の順に進む', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toFeed()
    await answer(false)

    expect(document.querySelector('.resetting.freeze')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    expect(document.querySelector('.resetting.loading')).toBeTruthy()
    expect(document.querySelector('.spinner')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByText('おすすめをリセットしました')).toBeTruthy()

    // 演出が終わると次の1本へ進む
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await waitFor(() => expect(document.querySelector('.resetting')).toBeNull())
  })

  it('右側のアイコンに数字が出て、動画ごとに変わる', async () => {
    await toFeed()
    const labels = [...document.querySelectorAll('.side-label')].map((e) => e.textContent)
    // 再生 / いいね / コメント / 共有
    expect(labels).toHaveLength(4)
    expect(labels[0]).toBe('再生')
    expect(labels.slice(1).every((t) => (t ?? '').length > 0)).toBe(true)

    const before = labels.join()
    await answer(true)
    await waitFor(() => {
      const now = [...document.querySelectorAll('.side-label')].map((e) => e.textContent).join()
      expect(now).not.toBe(before)
    })
  })

  it('投稿者名とキャプションが出る', async () => {
    await toFeed()
    expect(document.querySelector('.account')?.textContent).toMatch(/^@/)
    expect((document.querySelector('.caption')?.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('段階の進捗バーが8本出る', async () => {
    await toFeed()
    expect(document.querySelectorAll('.progress-bars .bar')).toHaveLength(RULES.totalStages)
    expect(document.querySelectorAll('.progress-bars .bar.now')).toHaveLength(1)
  })

  it('正解すると進捗バーが進む', async () => {
    await toFeed()
    const nowIndex = () =>
      [...document.querySelectorAll('.progress-bars .bar')].findIndex((b) =>
        b.classList.contains('now'),
      )
    expect(nowIndex()).toBe(0)
    await answer(true)
    await waitFor(() => expect(nowIndex()).toBe(1))
  })

  it('画面を離れると映像が止まる', async () => {
    await toFeed()
    const shown = [...document.querySelectorAll('.swipe-card video')].find(
      (v) => (v as HTMLElement).style.opacity === '1',
    ) as HTMLVideoElement

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(shown.pause).toHaveBeenCalled()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('clips.json が読めないときは案内を出す', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/動画を読み込めませんでした/)).toBeTruthy())
  })
})
