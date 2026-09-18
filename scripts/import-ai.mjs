#!/usr/bin/env node
/**
 * AI生成動画をゲームに取り込む。
 *
 *   npm run import:ai            clips/ の中身で AI 役を差し替える
 *   npm run import:ai -- --add   いまの AI 役を残して追加する
 *   npm run import:ai -- --in clips/batch2
 *
 * 本物側のエントリは触らない。
 * 劣化処理は本物と同じ（18fps / 480x360 / モノクロ / 自動レベル補正 /
 * コントラスト / フィルムノイズ / 周辺減光 / 無音 / faststart）なので、
 * 画質や解像度から見分けられることはない。
 *
 * 生成ツールが焼き込む左上のウォーターマークは、切り落として消す。
 * delogo は画面端すぎて補間元が無く、黒い三角形の破綻が出るため使わない。
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENCODE, lookChain, solveLook } from './lib/film-look.mjs'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')

/* ---- 調整するならここ ---- */
const DURATION = 10
/** 左上のウォーターマークを消すために切り落とす幅・高さ（px） */
const TRIM_LEFT = 56
const TRIM_TOP = 52
/** 生成ツール名。clips/ai-meta.json で個別に上書きできる */
const DEFAULT_TOOL = '（生成ツール名を入れてください）'
/** 振り返り画面に出す解説。分かった手がかりを書き足してください */
const DEFAULT_NOTE = '（AIと見抜ける手がかりを書いてください）'
/* ------------------------- */

const args = process.argv.slice(2)
const ADD = args.includes('--add')
const NO_TRIM = args.includes('--no-trim')
const inArg = args.indexOf('--in')
const inDir = path.resolve(root, inArg >= 0 ? args[inArg + 1] : 'clips')

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const makeId = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

const trim = NO_TRIM ? null : { left: TRIM_LEFT, top: TRIM_TOP }

async function convert(input, outFile, seed) {
  // 実際に通した結果を測りながら、本物と同じ目標へ寄せる
  const { params, result } = await solveLook(input, seed, trim)
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-t', String(DURATION),
    '-vf', lookChain(params, seed, trim),
    '-an',
    ...ENCODE,
    outFile,
  ])
  return result
}

async function main() {
  const files = (await readdir(inDir).catch(() => []))
    .filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f))
    .sort()

  if (files.length === 0) {
    console.error(`${path.relative(root, inDir)}/ に動画がありません。`)
    process.exit(1)
  }

  // 1本ずつ生成ツール名や解説を変えたいときに使う任意のファイル
  const meta = JSON.parse(
    await readFile(path.join(inDir, 'ai-meta.json'), 'utf8').catch(() => '{}'),
  )

  let existing = { version: 1, clips: [] }
  try {
    existing = JSON.parse(await readFile(jsonPath, 'utf8'))
  } catch {
    /* まだ無ければ新規に作る */
  }
  const realClips = existing.clips.filter((c) => !c.isAI)
  const oldAI = existing.clips.filter((c) => c.isAI)

  // 差し替えのときは先に古いファイルを消す。
  // あとから消すと、ID が偶然一致したときに作ったばかりのファイルを消してしまう
  if (!ADD) {
    for (const c of oldAI) await rm(path.join(root, 'public', c.src), { force: true })
  }

  await mkdir(outDir, { recursive: true })

  const made = []
  for (const file of files) {
    const id = makeId()
    const m = meta[file] ?? {}
    await convert(path.join(inDir, file), path.join(outDir, `${id}.mp4`), id)

    made.push({
      id,
      src: `clips/${id}.mp4`,
      isAI: true,
      // 1本ずつ別のグループにする。まとめて同じ値にすると
      // 「同じ作品の場面は連続しない」規則により AI が2本続けて出なくなり、
      // AI のあとは必ず本物、という手がかりを与えてしまう
      work: m.work ?? `gen-${id}`,
      title: m.title ?? '生成クリップ',
      tool: m.tool ?? DEFAULT_TOOL,
      sourceUrl: '',
      license: m.license ?? '自作（AI生成）',
      note: m.note ?? DEFAULT_NOTE,
    })
    console.log(`  ${file} → ${id}.mp4`)
  }

  const ai = ADD ? [...oldAI, ...made] : made

  // 本物と AI を交互に近い並びにしておく（出題順とは無関係）
  const clips = []
  for (let i = 0; i < Math.max(realClips.length, ai.length); i++) {
    if (realClips[i]) clips.push(realClips[i])
    if (ai[i]) clips.push(ai[i])
  }

  await writeFile(jsonPath, JSON.stringify({ version: 1, clips }, null, 2) + '\n', 'utf8')
  console.log(`\n完了: AI ${ai.length}本 / 本物 ${realClips.length}本`)

  const needsMeta = ai.filter((c) => c.note === DEFAULT_NOTE).length
  if (needsMeta > 0) {
    console.warn(
      `\n注意: ${needsMeta}本 の解説が未記入です。` +
        `\n  振り返り画面に出る文章なので、public/clips.json の note を埋めるか、` +
        `\n  ${path.relative(root, inDir)}/ai-meta.json に書いてから取り込み直してください。`,
    )
  }
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
