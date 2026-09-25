#!/usr/bin/env node
/**
 * ダミー動画（10秒 / 9:16 / 720x1280 / 24fps / 無音 / H.264）と
 * public/clips.json を生成する。
 *
 *   npm run gen:dummy                既定（本物役10本・AI役10本）
 *   npm run gen:dummy -- --seed 42
 *   npm run gen:dummy -- --force     生成済みでも作り直す
 *   npm run gen:dummy -- --if-missing 未生成のときだけ（compose の起動時に使用）
 *
 * 実素材が用意できるまでの仮データ。ファイル名は答えが分からないランダムID。
 * ID はシードから決定的に作るので、再実行しても同じ結果になる。
 *
 * 動作確認しやすいよう、本物役は落ち着いた色、AI役は彩度が高く滑らか、と
 * 見た目を分けてある。実素材に差し替えれば無くなる差。
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')

const DURATION = 10
const WIDTH = 720
const HEIGHT = 1280
const FPS = 24

const args = process.argv.slice(2)
const seedArg = args.indexOf('--seed')
const SEED = seedArg >= 0 ? Number(args[seedArg + 1]) : 20260925
const FORCE = args.includes('--force')
const SKIP_IF_PRESENT = args.includes('--if-missing')

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
 * カテゴリは本物役とAI役で同じものを使う。
 * カテゴリが答えの手がかりになってしまわないようにするため。
 * ------------------------------------------------------------------ */

const REAL_LOOK =
  `eq=saturation=0.92:contrast=1.04,noise=alls=6:allf=t,` +
  `scale=${WIDTH}:${HEIGHT}:flags=bicubic,setsar=1,fps=${FPS}`

const AI_LOOK =
  `eq=saturation=1.35:contrast=1.08:brightness=0.03,gblur=sigma=0.6,` +
  `scale=${WIDTH}:${HEIGHT}:flags=bicubic,setsar=1,fps=${FPS}`

/** 本物役：5カテゴリ × 2場面 */
const REAL_CLIPS = [
  { category: '自然・風景', scene: '滝', src: 'testsrc2=size=540x960:rate=24' },
  { category: '自然・風景', scene: '海辺', src: 'gradients=size=540x960:rate=24:n=3:speed=0.02' },
  { category: '動物', scene: '猫', src: 'life=size=180x320:rate=12:ratio=0.4:life_color=#c8b89a:death_color=#20201c,scale=540:960:flags=neighbor' },
  { category: '動物', scene: '鳥', src: 'cellauto=size=540x960:rate=24:rule=110' },
  { category: '街', scene: '交差点', src: 'mandelbrot=size=540x960:rate=24:maxiter=120' },
  { category: '街', scene: '路地', src: 'sierpinski=size=540x960:rate=24:type=carpet' },
  { category: '食べ物', scene: 'コーヒー', src: 'smptebars=size=540x960:rate=24' },
  { category: '食べ物', scene: '麺', src: 'testsrc=size=540x960:rate=24' },
  { category: '空', scene: '雲', src: 'gradients=size=540x960:rate=24:n=2:speed=0.008' },
  { category: '空', scene: '夕焼け', src: 'mandelbrot=size=540x960:rate=24:start_scale=2.4' },
]

/** AI役：同じ5カテゴリ × 2場面 */
const AI_CLIPS = [
  { category: '自然・風景', scene: '渓谷', src: 'gradients=size=540x960:rate=24:n=4:speed=0.05' },
  { category: '自然・風景', scene: '湖', src: 'testsrc2=size=540x960:rate=24,hue=h=140' },
  { category: '動物', scene: '犬', src: 'life=size=200x356:rate=15:ratio=0.35:life_color=#7fd0ff:death_color=#101822,scale=540:960:flags=bicubic' },
  { category: '動物', scene: '魚', src: 'cellauto=size=540x960:rate=24:rule=30' },
  { category: '街', scene: '歩道', src: 'rgbtestsrc=size=540x960:rate=24' },
  { category: '街', scene: 'ネオン', src: 'mandelbrot=size=540x960:rate=24:inner=period:outer=iteration_count' },
  { category: '食べ物', scene: 'ケーキ', src: 'sierpinski=size=540x960:rate=24:type=triangle' },
  { category: '食べ物', scene: '果物', src: 'yuvtestsrc=size=540x960:rate=24' },
  { category: '空', scene: '星空', src: 'cellauto=size=540x960:rate=24:rule=90:random_fill_ratio=0.08' },
  { category: '空', scene: 'オーロラ', src: 'gradients=size=540x960:rate=24:n=5:speed=0.09' },
]

/** ダミー用の投稿者名。本物もAIも同じ書式にして手がかりにしない */
const REAL_NAMES = ['haru_films', 'mist.and.moss', 'kohaku_ch', 'sotogawa', 'yuzu_daily']
const AI_NAMES = ['nagi_scenes', 'still.water', 'aoi_clip', 'hoshi_room', 'mado_kara']

async function encode(source, look, outFile) {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', source,
    '-t', String(DURATION),
    '-vf', look,
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '25',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0',
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
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const jobs = []
  REAL_CLIPS.forEach((c, i) => {
    jobs.push({
      id: makeId(), isAI: false, look: REAL_LOOK, source: c.src,
      meta: {
        category: c.category,
        scene: c.scene,
        source: 'ダミー（ffmpeg lavfi 生成）',
        sourceUrl: '',
        contributor: REAL_NAMES[i % REAL_NAMES.length],
        note: '実素材に差し替えるまでの仮クリップです。',
      },
    })
  })
  AI_CLIPS.forEach((c, i) => {
    jobs.push({
      id: makeId(), isAI: true, look: AI_LOOK, source: c.src,
      meta: {
        category: c.category,
        scene: c.scene,
        source: 'ダミー（ffmpeg lavfi 生成）',
        sourceUrl: '',
        contributor: AI_NAMES[i % AI_NAMES.length],
        tool: '仮・生成ツール',
        note: '実素材に差し替えるまでの仮クリップです。',
      },
    })
  })

  // clips.json の並びから答えが読めないようにシャッフルしておく
  for (let i = jobs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[jobs[i], jobs[j]] = [jobs[j], jobs[i]]
  }

  let done = 0
  const queue = [...jobs]
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        await encode(job.source, job.look, path.join(outDir, `${job.id}.mp4`))
        done++
        process.stdout.write(`\r  生成中 ${done}/${jobs.length}`)
      }
    }),
  )
  process.stdout.write('\n')

  const clips = jobs.map((j) => ({
    id: j.id,
    // 配信先が未定のため相対パスで保持し、実行時に BASE_URL と連結する
    src: `clips/${j.id}.mp4`,
    isAI: j.isAI,
    ...j.meta,
  }))

  await writeFile(jsonPath, JSON.stringify({ version: 1, clips }, null, 2) + '\n', 'utf8')

  const real = clips.filter((c) => !c.isAI).length
  console.log(`完了: 本物役 ${real}本 / AI役 ${clips.length - real}本 → public/clips/`)
  console.log(`      メタデータ: public/clips.json (seed=${SEED})`)
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
