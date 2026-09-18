#!/usr/bin/env node
/**
 * ダミー動画（10秒 / 4:3 / 無音 / H.264）と public/clips.json を生成する。
 *
 *   npm run gen:dummy            既定（本物役12本・AI役12本）
 *   npm run gen:dummy -- --seed 42
 *
 * 実素材が用意できるまでの仮データ。ファイル名は答えが分からないランダムID。
 * ID はシードから決定的に作るので、再実行しても同じ結果になる。
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')

const DURATION = 10
const WIDTH = 480
const HEIGHT = 360

const args = process.argv.slice(2)
const seedArg = args.indexOf('--seed')
const SEED = seedArg >= 0 ? Number(args[seedArg + 1]) : 20260918
const FORCE = args.includes('--force')
// 既に生成済みなら何もしない（docker compose 起動時に毎回走らせても無駄にならないように）
const SKIP_IF_PRESENT = args.includes('--if-missing')
// 本物側を gen:real で実映像に差し替えたあと、AI役だけ作り直したいとき
const AI_ONLY = args.includes('--ai-only')

/** 決定的な乱数（xorshift32） */
function makeRng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 0x100000000
  }
}
const rng = makeRng(SEED)

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
function makeId() {
  let out = ''
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(rng() * ALPHABET.length)]
  return out
}

/* ------------------------------------------------------------------ *
 * 本物役：フィルム質感（モノクロ・粒子・周辺減光・18fps）
 * AI役  ：デジタル質感（色あり・なめらか・粒子が少ない）
 * ------------------------------------------------------------------ */

const FILM_LOOK =
  `format=gray,eq=contrast=1.28:brightness=-0.04:gamma=0.95,` +
  `noise=alls=16:allf=t+u,vignette=PI/4.2,` +
  `scale=${WIDTH}:${HEIGHT}:flags=bicubic,setsar=1,fps=18`

const DIGITAL_LOOK =
  `eq=saturation=1.15:contrast=1.05,gblur=sigma=0.5,` +
  `scale=${WIDTH}:${HEIGHT}:flags=bicubic,setsar=1,fps=24`

/** 本物役：6作品 × 2場面 */
const REAL_WORKS = [
  { work: 'dummy-work-a', title: 'ダミー作品A（駅）', year: 1921, director: '仮 監督A',
    scenes: [`testsrc2=size=640x480:rate=25`, `testsrc2=size=640x480:rate=25,hue=s=0`] },
  { work: 'dummy-work-b', title: 'ダミー作品B（塔）', year: 1922, director: '仮 監督B',
    scenes: [`mandelbrot=size=640x480:rate=25:maxiter=120`, `mandelbrot=size=640x480:rate=25:maxiter=60:start_scale=2.2`] },
  { work: 'dummy-work-c', title: 'ダミー作品C（群衆）', year: 1925, director: '仮 監督C',
    scenes: [`life=size=320x240:rate=12:ratio=0.35:death_color=#101010:life_color=#e8e8e8,scale=640:480:flags=neighbor`,
             `life=size=160x120:rate=10:ratio=0.5:death_color=#000000:life_color=#cccccc,scale=640:480:flags=neighbor`] },
  { work: 'dummy-work-d', title: 'ダミー作品D（海）', year: 1928, director: '仮 監督D',
    scenes: [`cellauto=size=640x480:rate=25:rule=110`, `cellauto=size=640x480:rate=25:rule=30`] },
  { work: 'dummy-work-e', title: 'ダミー作品E（屋敷）', year: 1919, director: '仮 監督E',
    scenes: [`smptebars=size=640x480:rate=25`, `pal75bars=size=640x480:rate=25`] },
  { work: 'dummy-work-f', title: 'ダミー作品F（汽車）', year: 1931, director: '仮 監督F',
    scenes: [`sierpinski=size=640x480:rate=25:type=carpet`, `sierpinski=size=640x480:rate=25:type=triangle`] },
]

/** AI役：6系統 × 2本 */
const AI_SETS = [
  { work: 'dummy-gen-a', tool: '仮・生成ツールA',
    note: '手の指の本数が途中で変わる。輪郭が溶けるように揺れている。',
    scenes: [`gradients=size=640x480:rate=25:n=3:speed=0.03`, `gradients=size=640x480:rate=25:n=4:speed=0.08`] },
  { work: 'dummy-gen-b', tool: '仮・生成ツールB',
    note: '背景の文字がどのコマでも読めない形に崩れている。',
    scenes: [`rgbtestsrc=size=640x480:rate=25`, `yuvtestsrc=size=640x480:rate=25`] },
  { work: 'dummy-gen-c', tool: '仮・生成ツールC',
    note: '粒子の動きが画面全体で均一すぎる。フィルムの傷が一度も出ない。',
    scenes: [`testsrc=size=640x480:rate=25`, `testsrc=size=640x480:rate=25,negate`] },
  { work: 'dummy-gen-d', tool: '仮・生成ツールD',
    note: '人物の影の向きが光源と合っていない。',
    scenes: [`mandelbrot=size=640x480:rate=25:inner=period:outer=iteration_count`,
             `mandelbrot=size=640x480:rate=25:inner=convergence:outer=normalized_iteration_count`] },
  { work: 'dummy-gen-e', tool: '仮・生成ツールE',
    note: 'カメラが物理的に不可能な速度で被写体を回り込む。',
    scenes: [`life=size=200x150:rate=15:ratio=0.4:life_color=#7fd0ff:death_color=#101822,scale=640:480:flags=bicubic`,
             `life=size=200x150:rate=15:ratio=0.2:life_color=#ffcf7f:death_color=#1a1410,scale=640:480:flags=bicubic`] },
  { work: 'dummy-gen-f', tool: '仮・生成ツールF',
    note: '同じ模様が画面内で繰り返し現れる（生成モデル特有のタイル状の反復）。',
    scenes: [`cellauto=size=640x480:rate=25:rule=90:random_fill_ratio=0.1`,
             `allrgb=rate=25,scale=640:480:flags=neighbor`] },
]

async function encode(source, look, outFile) {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', source,
    '-t', String(DURATION),
    '-vf', look,
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
    '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-level', '3.0',
    '-movflags', '+faststart',
    outFile,
  ])
}

async function main() {
  if (SKIP_IF_PRESENT && !FORCE) {
    const existing = await readdir(outDir).catch(() => [])
    if (existing.some((f) => f.endsWith('.mp4'))) {
      console.log('ダミー動画は生成済みのためスキップしました（作り直すには --force）')
      return
    }
  }
  // gen:real で作った実映像を残したまま AI 役だけ作り直す
  let keep = []
  if (AI_ONLY) {
    const db = JSON.parse(await readFile(jsonPath, 'utf8').catch(() => '{"clips":[]}'))
    keep = db.clips.filter((c) => !c.isAI)
    for (const c of db.clips.filter((c) => c.isAI)) {
      await rm(path.join(root, 'public', c.src), { force: true })
    }
  } else {
    await rm(outDir, { recursive: true, force: true })
  }
  await mkdir(outDir, { recursive: true })

  const jobs = []

  if (!AI_ONLY) for (const w of REAL_WORKS) {
    w.scenes.forEach((source, i) => {
      jobs.push({
        id: makeId(),
        isAI: false,
        work: w.work,
        source,
        look: FILM_LOOK,
        meta: {
          title: `${w.title} 第${i + 1}場面`,
          year: w.year,
          director: w.director,
          sourceUrl: 'https://example.invalid/dummy',
          license: 'ダミー素材（ffmpeg lavfi 生成 / 差し替え前提）',
          note: '実素材に差し替えるまでの仮クリップです。',
        },
      })
    })
  }

  for (const g of AI_SETS) {
    g.scenes.forEach((source, i) => {
      jobs.push({
        id: makeId(),
        isAI: true,
        work: g.work,
        source,
        look: DIGITAL_LOOK,
        meta: {
          title: `生成クリップ ${g.work}-${i + 1}`,
          tool: g.tool,
          sourceUrl: '',
          license: 'ダミー素材（ffmpeg lavfi 生成 / 差し替え前提）',
          note: g.note,
        },
      })
    })
  }

  // 出題順が読めないよう clips.json 内の並びもシャッフルしておく
  for (let i = jobs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[jobs[i], jobs[j]] = [jobs[j], jobs[i]]
  }

  let done = 0
  const CONCURRENCY = 4
  const queue = [...jobs]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        await encode(job.source, job.look, path.join(outDir, `${job.id}.mp4`))
        done++
        process.stdout.write(`\r  生成中 ${done}/${jobs.length}`)
      }
    }),
  )
  process.stdout.write('\n')

  const made = jobs.map((j) => ({
    id: j.id,
    // 配信先が未定のため相対パスで保持し、実行時に BASE_URL と連結する
    src: `clips/${j.id}.mp4`,
    isAI: j.isAI,
    work: j.work,
    ...j.meta,
  }))

  // --ai-only のときは、残した本物と交互に近い並びにする
  const clips = []
  const max = Math.max(keep.length, made.length)
  for (let i = 0; i < max; i++) {
    if (keep[i]) clips.push(keep[i])
    if (made[i]) clips.push(made[i])
  }

  await writeFile(jsonPath, JSON.stringify({ version: 1, clips }, null, 2) + '\n', 'utf8')

  const real = clips.filter((c) => !c.isAI).length
  console.log(`完了: 本物役 ${real}本 / AI役 ${clips.length - real}本 → public/clips/`)
  console.log(`      メタデータ: public/clips.json (seed=${SEED})`)
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
