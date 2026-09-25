#!/usr/bin/env node
/**
 * 素材を配信用に正規化する。
 *
 *   npm run normalize             raw/real と raw/ai を取り込む
 *   npm run normalize -- --add    いまの clips.json を残して追加する
 *   npm run normalize -- --start 3   各素材の何秒目から10秒を切り出すか
 *
 * raw/real/ と raw/ai/ の動画を
 *   中央切り取りで 9:16 → 720x1280 / 24fps / 10秒 / 無音 / H.264 / faststart
 * に揃えて、ランダムなIDで public/clips/ に書き出し、clips.json を更新する。
 *
 * 元のファイル名と生成したIDの対応表は raw/id-map.json に残す。
 * これが公開されると答えが分かってしまうので、raw/ ごと git 管理外にしてある。
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rawDir = path.join(root, 'raw')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')
const mapPath = path.join(rawDir, 'id-map.json')

/* ---- 配信フォーマット。ここだけ触れば揃う ---- */
const DURATION = 10
const WIDTH = 720
const HEIGHT = 1280
const FPS = 24

/**
 * 取り込む前に切り落とす端（px）。素材の縦幅に対する割合で指定する。
 *
 * 生成ツールが左上に焼き込むウォーターマークを消すために使う。
 * 本物側には無いので、残っていると一目で分かってしまう。
 * delogo は画面端すぎて補間元が無く、かえって目立つ跡が残るので使わない。
 *
 * ツールを変えて位置や大きさが違うときは、この値を調整すること。
 * 透かしが無い素材なら 0 にする。
 */
const TRIM = {
  real: { topRatio: 0 },
  ai: { topRatio: 0.06 },
}
/* --------------------------------------------- */

const args = process.argv.slice(2)
const ADD = args.includes('--add')
const startArg = args.indexOf('--start')
const START = startArg >= 0 ? String(args[startArg + 1]) : '0'

const VIDEO = /\.(mp4|mov|webm|mkv|m4v)$/i

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const makeId = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

/**
 * カテゴリと場面の割り当て。
 * raw/real/自然・風景/滝.mp4 のようにフォルダで分けておくとそのまま拾う。
 * 直置きの場合はファイル名から推測し、分からなければ「未分類」にする。
 */
function classify(relPath) {
  const parts = relPath.split(path.sep)
  const file = path.parse(parts[parts.length - 1]).name
  if (parts.length >= 2) return { category: parts[0], scene: file }
  return { category: '未分類', scene: file }
}

/** raw/<kind>/ 以下を再帰的に集める */
async function collect(kind) {
  const base = path.join(rawDir, kind)
  const out = []
  async function walk(dir, rel) {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      const next = rel ? path.join(rel, entry.name) : entry.name
      if (entry.isDirectory()) await walk(full, next)
      else if (VIDEO.test(entry.name)) out.push({ full, rel: next })
    }
  }
  await walk(base, '')
  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

/**
 * 中央切り取りで 9:16 にしてから拡大縮小する。
 * 横長の素材は左右を、縦長すぎる素材は上下を落とす。
 * topRatio が指定されていれば、先に上端を切り落とす（透かし対策）。
 */
function filtersFor(kind) {
  const trim = TRIM[kind]?.topRatio ?? 0
  const chain = []
  if (trim > 0) chain.push(`crop=iw:ih*${(1 - trim).toFixed(4)}:0:ih*${trim.toFixed(4)}`)
  chain.push(
    `crop='min(iw,ih*${WIDTH}/${HEIGHT})':'min(ih,iw*${HEIGHT}/${WIDTH})'`,
    `scale=${WIDTH}:${HEIGHT}:flags=bicubic`,
    'setsar=1',
    `fps=${FPS}`,
  )
  return chain.join(',')
}

async function convert(input, outFile, kind) {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', START,
    '-i', input,
    '-t', String(DURATION),
    '-vf', filtersFor(kind),
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0',
    '-movflags', '+faststart',
    outFile,
  ])
}

async function main() {
  const real = await collect('real')
  const ai = await collect('ai')

  if (real.length + ai.length === 0) {
    console.error(
      'raw/real/ と raw/ai/ に動画がありません。\n' +
        '  例: raw/real/自然・風景/滝.mp4 のようにカテゴリのフォルダを作って置いてください。',
    )
    process.exit(1)
  }

  let existing = { version: 1, clips: [] }
  try {
    existing = JSON.parse(await readFile(jsonPath, 'utf8'))
  } catch {
    /* まだ無ければ新規に作る */
  }
  const keep = ADD ? existing.clips : []

  // 差し替えのときは、先に古いファイルを消す。
  // あとから消すと、ID が偶然一致したときに作ったばかりのファイルを消してしまう
  if (!ADD) {
    for (const c of existing.clips) await rm(path.join(root, 'public', c.src), { force: true })
  }
  await mkdir(outDir, { recursive: true })

  const idMap = ADD ? JSON.parse(await readFile(mapPath, 'utf8').catch(() => '{}')) : {}
  const made = []

  for (const [kind, list] of [
    ['real', real],
    ['ai', ai],
  ]) {
    for (const item of list) {
      const id = makeId()
      const { category, scene } = classify(item.rel)
      await convert(item.full, path.join(outDir, `${id}.mp4`), kind)

      made.push({
        id,
        src: `clips/${id}.mp4`,
        isAI: kind === 'ai',
        category,
        scene,
        // 以下は取り込んだあと clips.json に手で書き足す
        source: '',
        sourceUrl: '',
        contributor: '',
        ...(kind === 'ai' ? { tool: '' } : {}),
        note: '',
      })
      idMap[id] = `${kind}/${item.rel}`
      console.log(`  ${kind}/${item.rel} → ${id}.mp4  [${category} / ${scene}]`)
    }
  }

  // 本物とAIが交互に近い並びになるようにしておく（出題順とは無関係）
  const fresh = [...keep, ...made]
  const r = fresh.filter((c) => !c.isAI)
  const a = fresh.filter((c) => c.isAI)
  const clips = []
  for (let i = 0; i < Math.max(r.length, a.length); i++) {
    if (r[i]) clips.push(r[i])
    if (a[i]) clips.push(a[i])
  }

  await writeFile(jsonPath, JSON.stringify({ version: 1, clips }, null, 2) + '\n', 'utf8')
  await writeFile(mapPath, JSON.stringify(idMap, null, 2) + '\n', 'utf8')

  console.log(`\n完了: 本物 ${r.length}本 / AI ${a.length}本`)
  console.log('  対応表: raw/id-map.json（git 管理外。公開しないこと）')
  const blank = clips.filter((c) => !c.contributor).length
  if (blank > 0) {
    console.warn(
      `\n注意: ${blank}本 の提供者・出典が空です。` +
        '\n  クレジット画面と振り返り画面に出るので、public/clips.json を埋めてください。',
    )
  }
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
