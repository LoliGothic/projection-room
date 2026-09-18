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

/** 本物12本 / AI12本 のダミー clips.json */
const clipsFile: ClipsFile = {
  version: 1,
  clips: Array.from({ length: 24 }, (_, i) => ({
    id: `c${i}`,
    src: `clips/c${i}.mp4`,
    isAI: i % 2 === 1,
    work: `w${Math.floor(i / 2)}`,
    title: `作品 ${i}`,
    year: 1920 + i,
    tool: i % 2 === 1 ? '仮ツール' : undefined,
    note: 'メモ',
  })),
}

beforeEach(() => {
  window.localStorage.clear()
  // ストアはモジュール単位で生きているのでテストごとに戻す
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

/** 注意表示を抜けてタイトルまで出す */
async function toTitle() {
  render(<App />)
  await waitFor(() => expect(screen.getByText('はじめに')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '了解した' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '上映を始める' })).toBeTruthy())
}

/** 上映を始めて、字幕カードを抜けてプレイ中まで進める */
async function toPlaying() {
  await toTitle()
  fireEvent.click(screen.getByRole('button', { name: '上映を始める' }))
  await waitFor(() => expect(screen.getByText(/^第.巻$/)).toBeTruthy())
  await act(async () => {
    vi.advanceTimersByTime(4000)
  })
  await waitFor(() => expect(screen.getByRole('button', { name: 'もう一度映写する' })).toBeTruthy())
}

/** いま映っている動画の clips.json 上の定義 */
function activeClip() {
  const shown = [...document.querySelectorAll('.card video')].find(
    (v) => (v as HTMLElement).style.opacity === '1',
  )
  const src = shown?.getAttribute('src') ?? ''
  return clipsFile.clips.find((c) => src.endsWith(`${c.id}.mp4`))
}

/** 正しく / わざと間違えて回答する */
async function answer(correct: boolean) {
  const clip = activeClip()
  if (!clip) throw new Error('映っている動画が見つかりません')
  const burn = correct ? clip.isAI : !clip.isAI
  await act(async () => {
    fireEvent.keyDown(window, { key: burn ? 'ArrowLeft' : 'ArrowRight' })
  })
}

/** 字幕カードやループ演出を時間で進める */
async function runCutscenes() {
  await act(async () => {
    vi.advanceTimersByTime(6000)
  })
}

/** エンディングの字幕カードを最後まで送る */
async function runEndingCards() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      vi.advanceTimersByTime(3500)
    })
    if (screen.queryByText('終幕')) return
  }
  throw new Error('エンディングの字幕カードが終わりませんでした')
}

describe('画面が実際に動く', () => {
  it('初回は注意表示が出て、了解するとタイトルになる', async () => {
    await toTitle()
    expect(screen.getByText('映写室')).toBeTruthy()
  })

  it('注意表示は 2 回目以降に出ない', async () => {
    await toTitle()
    cleanup()
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: '上映を始める' })).toBeTruthy())
    expect(screen.queryByText('はじめに')).toBeNull()
  })

  it('上映を始めると字幕カードを経てゲーム画面になる', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()
    expect(document.querySelector('video')).toBeTruthy()
    // スワイプ中に出る左右の表示と、下部の操作案内がどちらも出ている
    expect(document.querySelector('.verdict.burn')?.textContent).toBe('焼き捨てる')
    expect(document.querySelector('.verdict.project')?.textContent).toBe('映写する')
    expect(document.querySelector('.hint')?.textContent).toContain('焼き捨てる')
  })

  it('矢印キーで回答すると次の動画に進む', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()
    const srcBefore = document.querySelector('video')?.getAttribute('src')

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    await waitFor(() => {
      const shown = [...document.querySelectorAll('video')].find(
        (v) => (v as HTMLElement).style.opacity === '1',
      )
      expect(shown?.getAttribute('src')).not.toBe(srcBefore)
    })
  })

  it('先読み用の <video> が current + preload ぶん並んでいる', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()
    expect(document.querySelectorAll('.card video')).toHaveLength(RULES.preloadAhead + 1)
  })

  it('先読み用の <video> が枠の外にはみ出さない（重ねて配置されている）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()

    // 絶対配置でないと 3 枚が縦に並び、枠の下（操作案内のあたり）に映ってしまう
    for (const v of document.querySelectorAll('.card video')) {
      const style = (v as HTMLElement).style
      expect(style.position).toBe('absolute')
      expect(style.inset).toBe('0px')
    }
  })

  it('回答するたびにスロットが変わっても、表示中の1枚だけが見えている', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()

    // スロットは 3 つを順に使い回すので、3 回ぶん確かめれば一巡する
    for (let i = 0; i < 4; i++) {
      const videos = [...document.querySelectorAll('.card video')] as HTMLElement[]
      const visible = videos.filter((v) => v.style.opacity === '1')
      expect(visible).toHaveLength(1)
      expect(visible[0].getAttribute('src')).toBeTruthy()

      await answer(true)
      await runCutscenes()
    }
  })

  it('上映記録・設定・クレジットを開いて戻れる', async () => {
    await toTitle()
    for (const [open, heading] of [
      ['上映記録', '上映記録'],
      ['設定', '設定'],
      ['クレジット', 'クレジット'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: open }))
      await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: '戻る' }))
      await waitFor(() => expect(screen.getByRole('button', { name: '上映を始める' })).toBeTruthy())
    }
  })

  it('未達成のエンディングは ？？？ とヒントだけ出す', async () => {
    await toTitle()
    fireEvent.click(screen.getByRole('button', { name: '上映記録' }))
    await waitFor(() => expect(screen.getAllByText('？？？').length).toBeGreaterThan(0))
  })

  it('設定の変更が保存される', async () => {
    await toTitle()
    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    const reduce = await screen.findByLabelText('点滅を弱める')
    fireEvent.click(reduce)
    expect((reduce as HTMLInputElement).checked).toBe(true)
    expect(window.localStorage.getItem('projection-room:settings')).toContain('"reduceFlashing":true')
  })

  it('ミスすると焦げの演出が出て第1巻に戻る', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()

    // 第2巻まで進めてからミスする
    for (let i = 0; i < RULES.clipsPerReel; i++) await answer(true)
    await runCutscenes()
    expect(screen.getByText('第二巻')).toBeTruthy()

    await answer(false)
    expect(document.querySelector('.loopcut')).toBeTruthy()
    // 焦げのあいだは下の映像が残っている
    expect(document.querySelector('.card video')).toBeTruthy()

    await runCutscenes()
    await runCutscenes()
    expect(screen.getByText('第一巻')).toBeTruthy()
  })

  it('全8巻を通すと真エンドになり、振り返りへ進める', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()

    for (let i = 0; i < RULES.totalReels * RULES.clipsPerReel; i++) {
      await answer(true)
      await runCutscenes()
    }

    await runEndingCards()
    expect(screen.getByRole('heading', { name: '完全上映' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '振り返る' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '振り返り' })).toBeTruthy())
    expect(screen.getByText('一本も取り違えなかった。')).toBeTruthy()
  })

  it('間違えた動画は振り返りで解説つきで見られる', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()

    await answer(false)
    await runCutscenes()
    await runCutscenes()

    // 暗闇エンドまで飛ばして振り返りを開く
    await act(async () => {
      vi.advanceTimersByTime(61_000)
    })
    await runEndingCards()

    fireEvent.click(screen.getByRole('button', { name: '振り返る' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '振り返り' })).toBeTruthy())
    expect(screen.getByText('1 / 1')).toBeTruthy()
    expect(document.querySelector('.recap-video')).toBeTruthy()
  })

  it('エンディングを見ると一覧に残る', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await toPlaying()
    await act(async () => {
      vi.advanceTimersByTime(61_000)
    })
    await runEndingCards()

    fireEvent.click(screen.getByRole('button', { name: '映写室を出る' }))
    fireEvent.click(await screen.findByRole('button', { name: '上映記録' }))
    await waitFor(() => expect(screen.getByText('暗闇')).toBeTruthy())
  })

  it('clips.json が読めないときは案内を出す', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/フィルムが見つかりません/)).toBeTruthy())
  })
})
