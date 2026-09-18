#!/usr/bin/env node
/**
 * clip_picker.py で切り出した saved/ の10秒クリップをゲームに取り込む。
 *
 *   npm run import:saved          本物側を saved/ の中身に差し替える
 *   npm run import:saved -- --add 今ある本物を残したまま追加する
 *
 * AI役のエントリは触らない。
 * 劣化処理は prep:clip と同じ（18fps / 480x360 / モノクロ / 自動レベル補正 /
 * コントラスト / フィルムノイズ / 周辺減光 / 無音 / faststart）。
 * 出力ファイル名は答えが分からないランダムID。
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
const savedDir = path.join(root, 'saved')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')

/* ---- 調整するならここ ---- */
const DURATION = 10
/* 質感の処理は scripts/lib/film-look.mjs に集約（AI側とまったく同じものを通す） */
/* ------------------------- */

/**
 * 元映画ごとの表示用メタデータ。クレジット画面と振り返り画面に出る。
 * キーは saved/clips.csv の source_file から拡張子を除いたもの。
 * ここに無いものはファイル名から機械的に作るので、気になるものだけ足せばよい。
 *
 * director が空のものは、確かな出典を確認できなかったもの。
 * 調べて埋めるか、空のままにしておいてください（推測では入れていません）。
 */
const TITLES = {
  'Safety_Last_(1923)': { title: 'ロイドの要心無用', year: 1923, director: 'フレッド・ニューメイヤー／サム・テイラー' },
  'Big_Business_(1929)_-_16mm_-_Silent_-_UHD': { title: 'ビッグ・ビジネス', year: 1929, director: 'ジェームズ・W・ホーン' },
  "Hell's_Hinges_-_1916": { title: 'ヘルズ・ヒンジズ', year: 1916, director: '' },
  'The_Cheat_(1915)': { title: 'チート', year: 1915, director: 'セシル・B・デミル' },
  'Les_Vampires_-_Satanas(1916)': { title: 'レ・ヴァンピール 第5話「サタナス」', year: 1916, director: 'ルイ・フイヤード' },
  'Tumbleweeds_(1925)': { title: 'タンブルウィーズ', year: 1925, director: '' },
  'Le_Voyage_dans_la_lune_(black_and_white,_1902)': { title: '月世界旅行', year: 1902, director: 'ジョルジュ・メリエス' },
  'Our_Hospitality_(1923)': { title: '荒武者キートン', year: 1923, director: 'バスター・キートン／ジョン・G・ブライストン' },
}

const args = process.argv.slice(2)
const ADD = args.includes('--add')

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const makeId = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

/** 1行ぶんの CSV を分解する（引用符つきのフィールドに対応） */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/** saved/clips.csv を「クリップのファイル名 → 元映画と切り出し位置」に変換する */
async function readLog() {
  const map = new Map()
  const text = await readFile(path.join(savedDir, 'clips.csv'), 'utf8').catch(() => '')
  if (!text) return map

  const lines = text.split('\n').filter((l) => l.trim())
  const header = parseCsvLine(lines[0])
  const col = (name) => header.indexOf(name)

  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line)
    const file = f[col('file')]
    if (!file) continue
    map.set(file, {
      sourceFile: f[col('source_file')] ?? '',
      startSec: Number(f[col('start_sec')] ?? 0),
      sourceUrl: f[col('source_url')] ?? '',
      license: f[col('license')] ?? '',
      memo: f[col('memo')] ?? '',
    })
  }
  return map
}

/** ファイル名の末尾に付く切り出し位置（_01932.86）を取り除く */
function sourceStemFrom(fileName) {
  return path.parse(fileName).name.replace(/_\d{4,}\.\d{2}$/, '')
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** TITLES に無いものは、ファイル名から読める範囲で埋める */
function metaFor(stem) {
  const known = TITLES[stem]
  if (known) return known
  const year = Number(stem.match(/(18|19|20)\d{2}/)?.[0]) || undefined
  const title = stem
    .replace(/[_-]+/g, ' ')
    .replace(/\((18|19|20)\d{2}\)/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { title, year, director: '' }
}

async function convert(input, outFile, seed) {
  // 実際に通した結果を測りながら、AI側と同じ目標へ寄せる
  const { params, result } = await solveLook(input, seed, null)
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-t', String(DURATION),
    '-vf', lookChain(params, seed, null),
    '-an',
    ...ENCODE,
    outFile,
  ])
  return result
}

async function main() {
  const files = (await readdir(savedDir).catch(() => []))
    .filter((f) => f.toLowerCase().endsWith('.mp4'))
    .sort()

  if (files.length === 0) {
    console.error('saved/ に mp4 がありません。clip_picker.py で切り出してください。')
    process.exit(1)
  }

  const log = await readLog()

  let existing = { version: 1, clips: [] }
  try {
    existing = JSON.parse(await readFile(jsonPath, 'utf8'))
  } catch {
    /* まだ無ければ新規に作る */
  }
  const aiClips = existing.clips.filter((c) => c.isAI)
  const oldReal = existing.clips.filter((c) => !c.isAI)

  // 差し替えのときは先に古い本物クリップを消す。
  // あとから消すと、ID が偶然一致したときに作ったばかりのファイルを消してしまう
  if (!ADD) {
    for (const c of oldReal) await rm(path.join(root, 'public', c.src), { force: true })
  }

  await mkdir(outDir, { recursive: true })

  const made = []
  for (const file of files) {
    const info = log.get(file)
    const stem = info?.sourceFile ? path.parse(info.sourceFile).name : sourceStemFrom(file)
    const meta = metaFor(stem)
    const id = makeId()

    await convert(path.join(savedDir, file), path.join(outDir, `${id}.mp4`), id)

    const at = info?.startSec
    made.push({
      id,
      src: `clips/${id}.mp4`,
      isAI: false,
      // 同じ映画の場面が連続しないようにするための識別子
      work: slug(stem),
      title: meta.title,
      ...(meta.year ? { year: meta.year } : {}),
      ...(meta.director ? { director: meta.director } : {}),
      sourceUrl: info?.sourceUrl || '',
      license: info?.license || 'Public Domain（入手元URLを clips.json に追記してください）',
      note:
        info?.memo ||
        (at !== undefined
          ? `${meta.title} より ${Math.floor(at / 60)}分${Math.round(at % 60)}秒あたり`
          : meta.title),
    })
    console.log(`  ${file} → ${id}.mp4  [${meta.title}]`)
  }

  const real = ADD ? [...oldReal, ...made] : made

  // 本物と AI を交互に近い並びにしておく（出題順とは無関係）
  const clips = []
  for (let i = 0; i < Math.max(real.length, aiClips.length); i++) {
    if (real[i]) clips.push(real[i])
    if (aiClips[i]) clips.push(aiClips[i])
  }

  await writeFile(jsonPath, JSON.stringify({ version: 1, clips }, null, 2) + '\n', 'utf8')

  const works = new Set(real.map((c) => c.work)).size
  console.log(`\n完了: 本物 ${real.length}本（${works}作品） / AI役 ${aiClips.length}本`)
  if (real.length < 8) {
    console.warn(`注意: 1周は8本です。本物が ${real.length}本 だと出題が偏ります。`)
  }
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
