#!/usr/bin/env node
/**
 * sources/ の実映画から「本物」のクリップを切り出して public/clips/ に入れ、
 * public/clips.json の本物側を差し替える。AI役のエントリはそのまま残す。
 *
 *   npm run gen:real
 *   npm run gen:real -- --per-work 2 --seed 7
 *
 * 切り出しは prep:clip と同じ劣化処理（10秒 / 18fps / 480x360 / モノクロ /
 * コントラスト強め / フィルムノイズ / 周辺減光 / 無音 / faststart）。
 * 無声映画の字幕カード（静止画）に当たった候補は捨てて次の位置を試す。
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'sources')
const outDir = path.join(root, 'public', 'clips')
const jsonPath = path.join(root, 'public', 'clips.json')

/* ---- 調整するならここ ---- */
const DURATION = 10
const FPS = 18
const WIDTH = 480
const HEIGHT = 360
const NOISE = 14
const VIGNETTE = 'PI/3.4'
const FILTERS = [
  `fps=${FPS}`,
  `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase`,
  `crop=${WIDTH}:${HEIGHT}`,
  'setsar=1',
  'format=gray',
  // 転写によって露出がばらばらなので、まず自動で階調を伸ばして揃える。
  // これが無いと暗い転写（ジキル博士など）がほぼ真っ黒になり判断できない
  'normalize=blackpt=black:whitept=white:smoothing=40',
  'eq=contrast=1.18:brightness=0.02:gamma=1.02',
  `noise=alls=${NOISE}:allf=t+u`,
  `vignette=${VIGNETTE}`,
].join(',')
/** 候補を探す範囲（前後をこれだけ避ける） */
const EDGE_MARGIN = 0.08
/** 1本あたり何回まで位置を変えて試すか */
const MAX_TRIES = 10
/**
 * 候補として使える明るさと動きの範囲（元素材を解析して判定する）。
 * 暗すぎると判断できず、明るすぎるものは字幕カードや新聞など文字だけの静止画が多い。
 * 実測: 新聞のカット YAVG=181 / 真っ黒なカット YAVG=13 / 使えるカット YAVG=74〜155
 */
const MIN_BRIGHTNESS = 30
const MAX_BRIGHTNESS = 165
/** 連続フレームの差。これを下回るとほぼ静止画 */
const MIN_MOTION = 1.8
/* ------------------------- */

/**
 * 元映画のメタデータ。sourceUrl は入手元が分からないので空にしてある。
 * クレジット画面に出るので、分かる範囲で埋めてください。
 *
 * picks: 目で見て確認した切り出し位置（秒）。
 *   素材の粒子が強く、字幕カードや新聞の挿入カットを明るさや動きだけで自動判別するのは
 *   無理だった（白抜き文字の字幕は平均が暗いカットと区別できない）。
 *   そのため確認済みの位置をここに固定している。
 *   picks を消すと自動探索（明るすぎ・暗すぎ・動きなしを避ける）に切り替わる。
 */
const CATALOG = [
  {
    file: 'Nosferatu_(1922,_English_titles_1947).webm',
    work: 'nosferatu',
    title: 'ノスフェラトゥ',
    year: 1922,
    director: 'F・W・ムルナウ',
    clips: 2,
    picks: [2000, 4100],
  },
  {
    file: 'The_Cabinet_of_Dr._Caligari.webm',
    work: 'caligari',
    title: 'カリガリ博士',
    year: 1920,
    director: 'ロベルト・ヴィーネ',
    clips: 2,
    picks: [446, 1757],
  },
  {
    file: 'The_Phantom_of_the_Opera_(1925)_preview.webm',
    work: 'phantom',
    title: 'オペラの怪人',
    year: 1925,
    director: 'ルパート・ジュリアン',
    clips: 2,
    picks: [3800, 5300],
  },
  {
    file: 'Dr._Jekyll_and_Mr._Hyde_(1920)_by_John_S._Robertson_HR.webm',
    work: 'jekyll',
    title: 'ジキル博士とハイド氏',
    year: 1920,
    director: 'ジョン・S・ロバートソン',
    clips: 1,
    picks: [3119],
  },
  {
    file: 'The_Unknown_(1927)_by_Tod_Browning.webm',
    work: 'unknown',
    title: 'ザ・アンノウン',
    year: 1927,
    director: 'トッド・ブラウニング',
    clips: 1,
    picks: [750],
  },
  {
    file: 'Riders_of_Destiny_(1933).webm',
    work: 'riders',
    title: 'ライダーズ・オブ・デスティニー',
    year: 1933,
    director: 'ロバート・N・ブラッドベリー',
    clips: 1,
    picks: [1333],
  },
  {
    file: 'The_Fall_of_the_House_of_Usher_(1928).webm',
    work: 'usher',
    title: 'アッシャー家の崩壊',
    year: 1928,
    director: '',
    clips: 1,
    picks: [510],
  },
  {
    file: "L'homme_à_la_tête_en_caoutchouc_(1901).webm",
    work: 'caoutchouc',
    title: 'ゴム頭の男',
    year: 1901,
    director: 'ジョルジュ・メリエス',
    clips: 1,
    picks: [98],
  },
  {
    file: 'The_Haunted_Castle_1896.ogv',
    work: 'haunted-castle',
    title: '悪魔の館',
    year: 1896,
    director: 'ジョルジュ・メリエス',
    clips: 1,
    picks: [112],
  },
]

const args = process.argv.slice(2)
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const SEED = Number(flag('seed', 20260919))
const PER_WORK = flag('per-work', null)

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
const makeId = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(rng() * ALPHABET.length)]).join('')

async function duration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ])
  return Number(stdout.trim())
}

async function cut(input, start, outFile) {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(start),
    '-i', input,
    '-t', String(DURATION),
    '-vf', FILTERS,
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '25',
    '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-level', '3.0',
    '-movflags', '+faststart',
    outFile,
  ])
}

/**
 * 切り出す前に元素材を解析して、その位置が出題に使えるか調べる。
 * ノイズを足したあとでは連続フレームが必ず変化してしまい静止画を見抜けないので、
 * 必ず加工前の素材に対して行う。
 */
async function analyze(input, start) {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-v', 'info',
    '-ss', String(start), '-i', input, '-t', String(DURATION), '-an',
    '-vf', 'fps=8,scale=240:180,format=gray,signalstats,metadata=print',
    '-f', 'null', '-',
  ])

  let yavgSum = 0, yavgN = 0, ydifSum = 0, ydifN = 0
  for (const line of stderr.split('\n')) {
    const avg = line.match(/signalstats\.YAVG=([\d.]+)/)
    if (avg) { yavgSum += Number(avg[1]); yavgN++ }
    const dif = line.match(/signalstats\.YDIF=([\d.]+)/)
    if (dif) { ydifSum += Number(dif[1]); ydifN++ }
  }
  return {
    brightness: yavgN ? yavgSum / yavgN : 0,
    motion: ydifN ? ydifSum / ydifN : 0,
  }
}

function usable(a) {
  return (
    a.brightness >= MIN_BRIGHTNESS &&
    a.brightness <= MAX_BRIGHTNESS &&
    a.motion >= MIN_MOTION
  )
}

/** 使える候補が見つからなかったときに、いちばんマシなものを選ぶための点数 */
function score(a) {
  const ideal = (MIN_BRIGHTNESS + MAX_BRIGHTNESS) / 2
  return -Math.abs(a.brightness - ideal) + Math.min(a.motion, 12) * 4
}

function entryFor(film, id, start) {
  return {
    id,
    src: `clips/${id}.mp4`,
    isAI: false,
    work: film.work,
    title: film.title,
    year: film.year,
    director: film.director,
    sourceUrl: '',
    license: 'Public Domain（入手元URLを clips.json に追記してください）',
    note: `${film.title}（${film.year}）より ${Math.floor(start / 60)}分${start % 60}秒あたり`,
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })

  // 既存の clips.json から AI 役だけ残す
  let existing = { version: 1, clips: [] }
  try {
    existing = JSON.parse(await readFile(jsonPath, 'utf8'))
  } catch {
    /* まだ無ければ新規に作る */
  }
  const aiClips = existing.clips.filter((c) => c.isAI)
  const oldReal = existing.clips.filter((c) => !c.isAI)

  // 先に古い本物クリップを消しておく。
  // 同じシードだと新旧で ID が一致しうるので、生成のあとに消すと作ったばかりの
  // ファイルを消してしまう
  for (const c of oldReal) {
    await rm(path.join(root, 'public', c.src), { force: true })
  }

  const made = []

  for (const film of CATALOG) {
    const input = path.join(srcDir, film.file)
    const total = await duration(input).catch(() => 0)
    if (!total) {
      console.warn(`  見つかりません（飛ばします）: ${film.file}`)
      continue
    }

    const picks = PER_WORK ? null : film.picks
    const want = picks ? picks.length : PER_WORK ? Number(PER_WORK) : film.clips
    const span = total * (1 - EDGE_MARGIN * 2)
    const from = total * EDGE_MARGIN

    for (let n = 0; n < want; n++) {
      const id = makeId()
      const outFile = path.join(outDir, `${id}.mp4`)
      // 作品内で位置が偏らないよう、区間を分けてその中から選ぶ
      const band = span / want
      let start = 0
      let best = null

      // 確認済みの位置があればそれを使う
      if (picks) {
        start = picks[n]
        await cut(input, start, outFile)
        made.push(entryFor(film, id, start))
        console.log(`  ${film.title} @${start}s → ${id}.mp4`)
        continue
      }

      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        const candidate = Math.round(from + band * n + rng() * Math.max(1, band - DURATION))
        const a = await analyze(input, candidate).catch(() => ({ brightness: 0, motion: 0 }))

        if (usable(a)) {
          start = candidate
          best = null
          break
        }
        const why = a.brightness < MIN_BRIGHTNESS ? '暗すぎ'
          : a.brightness > MAX_BRIGHTNESS ? '明るすぎ（字幕や新聞の可能性）'
          : '動きがない'
        process.stdout.write(
          `    取り直し ${film.work} @${candidate}s（${why} 明るさ${a.brightness.toFixed(0)} 動き${a.motion.toFixed(1)}）\n`,
        )
        if (!best || score(a) > score(best.a)) best = { start: candidate, a }
        start = candidate
      }

      // どの位置も条件を満たさなければ、いちばんマシだったものを使う
      if (best) {
        start = best.start
        console.warn(`    条件を満たす位置が見つからず、最良の候補を使います (${film.work} @${start}s)`)
      }

      await cut(input, start, outFile)

      made.push(entryFor(film, id, start))
      console.log(`  ${film.title} @${start}s → ${id}.mp4`)
    }
  }

  // 本物と AI を交互に近い並びにしておく（出題順とは無関係）
  const clips = []
  const max = Math.max(made.length, aiClips.length)
  for (let i = 0; i < max; i++) {
    if (made[i]) clips.push(made[i])
    if (aiClips[i]) clips.push(aiClips[i])
  }

  await writeFile(jsonPath, JSON.stringify({ version: 1, clips }, null, 2) + '\n', 'utf8')
  console.log(`\n完了: 本物 ${made.length}本 / AI役（ダミーのまま） ${aiClips.length}本`)
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
