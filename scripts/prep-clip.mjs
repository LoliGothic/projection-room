#!/usr/bin/env node
/**
 * 実素材（PD映画クリップ / AI生成動画）を同じ質感に揃えるための劣化処理。
 *
 *   npm run prep:clip -- --in clips/nosferatu.mp4 --start 00:12:30
 *   npm run prep:clip -- --in clips/gen01.mp4 --start 4 --ai --note "指の本数が変わる"
 *
 * 出力: 10秒 / 18fps / 480x360 / モノクロ / コントラスト強め / フィルムノイズ /
 *       周辺減光 / 音声なし / faststart 付き MP4
 * ファイル名は答えの分からないランダムID。
 * 実行後、public/clips.json に貼り付けるための JSON 断片を表示する（--append で自動追記）。
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENCODE, lookChain, solveLook } from './lib/film-look.mjs'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')

/* ---- 調整したくなる数値はここだけ ---- */
const DURATION = 10
/* 質感の処理は scripts/lib/film-look.mjs に集約（import:saved / import:ai と同じ） */
/* ------------------------------------ */

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const has = (name) => process.argv.includes(`--${name}`)

const input = arg('in')
const start = String(arg('start', '0'))
if (!input) {
  console.error(`使い方: npm run prep:clip -- --in <入力ファイル> --start <開始時刻> [オプション]

  --in <path>        入力ファイル（clips/ 以下など）
  --start <time>     切り出し開始位置（秒 または 00:01:23 形式）
  --ai               AI動画として登録する
  --title <text>     作品名 / 生成クリップ名
  --year <n>         公開年（本物の場合）
  --director <text>  監督名（本物の場合）
  --work <text>      元作品グループ。同じ作品の場面が連続しないようにするための識別子
  --source <url>     入手元URL
  --license <text>   ライセンス表記
  --tool <text>      生成ツール名（AIの場合）
  --note <text>      振り返り画面に出す解説
  --append           public/clips.json に自動で追記する
  --duration <sec>   切り出し長さ（既定 ${DURATION}）`)
  process.exit(1)
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const id = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const duration = Number(arg('duration', DURATION))
const outFile = path.join(outDir, `${id}.mp4`)


await mkdir(outDir, { recursive: true })

// 切り出した状態で質感を合わせたいので、いったん素の10秒を取り出す
const staged = path.join(outDir, `.${id}.stage.mp4`)
await run('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-ss', start, '-i', input, '-t', String(duration),
  '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
  '-pix_fmt', 'yuv420p', staged,
]).catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})

// 本物もAIもまったく同じ処理で質感を揃える
const { params } = await solveLook(staged, id, null)
await run('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', staged,
  '-vf', lookChain(params, id, null),
  '-an',
  ...ENCODE,
  outFile,
]).catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
await rm(staged, { force: true })

const isAI = has('ai')
const entry = {
  id,
  src: `clips/${id}.mp4`,
  isAI,
  work: String(arg('work', isAI ? `gen-${id}` : `work-${id}`)),
  title: String(arg('title', '（作品名を入れてください）')),
  ...(isAI ? {} : { year: Number(arg('year', 0)) || undefined, director: String(arg('director', '')) }),
  sourceUrl: String(arg('source', '')),
  license: String(arg('license', isAI ? '自作（AI生成）' : 'Public Domain')),
  ...(isAI ? { tool: String(arg('tool', '')) } : {}),
  note: String(arg('note', '')),
}

console.log(`出力: public/clips/${id}.mp4  (${duration}秒 / 18fps / 480x360 / 無音)`)

if (has('append')) {
  const db = JSON.parse(await readFile(jsonPath, 'utf8'))
  db.clips.push(entry)
  await writeFile(jsonPath, JSON.stringify(db, null, 2) + '\n', 'utf8')
  console.log(`public/clips.json に追記しました（全 ${db.clips.length} 本）`)
} else {
  console.log('\npublic/clips.json の clips 配列に追加してください:\n')
  console.log(JSON.stringify(entry, null, 2))
}
