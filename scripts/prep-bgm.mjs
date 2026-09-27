#!/usr/bin/env node
/**
 * BGM を配信用に切り出す。
 *
 *   npm run prep:bgm
 *
 * raw/bgm/ の音源の頭から10秒を取り、public/audio/bgm/ に書き出して
 * 一覧 public/audio/bgm.json を作る。
 *
 * 動画と同じ10秒でループさせるためのファイルなので、作りが少し変わっている。
 * 下の「ループの作り方」を読んでから数字を触ること。
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { randomInt } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'raw', 'bgm')
const outDir = path.join(root, 'public', 'audio', 'bgm')
const jsonPath = path.join(root, 'public', 'audio', 'bgm.json')

/* ---- 配信フォーマット。ここだけ触れば揃う ---- */
/**
 * ループの長さ（秒）。scripts/normalize.mjs の DURATION と必ず揃えること。
 * 動画のループと音楽のループを同じ周期にするための値で、ずらすと意味がなくなる。
 */
const LOOP = 10
/**
 * 継ぎ目をなじませる時間（秒）。
 * 終わりの直後の音を頭に薄く重ねて、波形の段差を消す。
 */
const SEAM = 0.15
/**
 * ループの前後に足す余白（秒）。詳しくは下の「ループの作り方」。
 */
const PAD = 0.2
const BITRATE = '112k'
const SAMPLE_RATE = 44100
/* --------------------------------------------- */

/*
  ## ループの作り方

  mp3 は符号化の都合で、デコードすると先頭に数十ミリ秒の空白が入ることがある。
  入るかどうかは再生する端末によって違う。素直に10秒ちょうどの mp3 を作って
  端から端までループさせると、その空白のぶんだけ毎周わずかな無音が挟まってしまう。

  そこで、10秒のループの前後に、ループ自身の端を巻き付けた余白を足してある。

      [ループの終わり0.2秒][ ループ 10.000秒 ][ループの頭0.2秒]
                          ↑ ここから10.000秒を切り出して回す

  こうしておくと、切り出す位置が数十ミリ秒ずれても、その前後には必ず音が続いて
  いる。位相がわずかにずれるだけで、長さは10.000秒ちょうどのまま保たれる。
  動画と揃えたいのは長さのほうなので、これで困らない。

  切り出す位置は public/audio/bgm.json に loopStart / loopEnd として書き出し、
  再生側（src/audio/engine.ts）がサンプル単位で指定する。
*/

const AUDIO = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const makeId = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

async function collect() {
  const entries = await readdir(srcDir, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.') && AUDIO.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
}

const ff = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

/**
 * 頭から LOOP 秒を取り、終わりの直後の音を頭に重ねて継ぎ目をなじませる。
 * 素材が短すぎて重ねる音が無いときは、そのまま切るだけにする。
 */
function seamFilter(hasTail) {
  if (!hasTail) return `atrim=0:${LOOP},asetpts=N/SR/TB`
  return [
    `[0:a]atrim=0:${LOOP},asetpts=N/SR/TB[body]`,
    `[0:a]atrim=${LOOP}:${LOOP + SEAM},asetpts=N/SR/TB,afade=t=out:st=0:d=${SEAM}[tail]`,
    '[body]asplit[b1][b2]',
    `[b1]atrim=0:${SEAM},asetpts=N/SR/TB,afade=t=in:st=0:d=${SEAM}[head]`,
    `[b2]atrim=${SEAM}:${LOOP},asetpts=N/SR/TB[rest]`,
    '[head][tail]amix=inputs=2:normalize=0[seam]',
    '[seam][rest]concat=n=2:v=0:a=1[out]',
  ].join(';')
}

/** ループの端を前後に巻き付ける */
const padFilter = [
  '[0:a]asplit=3[x][y][z]',
  `[x]atrim=${LOOP - PAD}:${LOOP},asetpts=N/SR/TB[pre]`,
  `[z]atrim=0:${PAD},asetpts=N/SR/TB[post]`,
  '[pre][y][post]concat=n=3:v=0:a=1[out]',
].join(';')

async function durationOf(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    file,
  ])
  return Number(stdout.trim()) || 0
}

async function convert(input, outFile, tmpFile) {
  const hasTail = (await durationOf(input)) >= LOOP + SEAM

  // まず 10.000 秒ちょうどのループを作る。途中は劣化させたくないので wav
  const seam = seamFilter(hasTail)
  await ff([
    '-i', input,
    ...(hasTail ? ['-filter_complex', seam, '-map', '[out]'] : ['-af', seam]),
    '-ar', String(SAMPLE_RATE),
    '-c:a', 'pcm_s16le',
    tmpFile,
  ])

  // 端を巻き付けて mp3 にする
  await ff([
    '-i', tmpFile,
    '-filter_complex', padFilter, '-map', '[out]',
    '-ar', String(SAMPLE_RATE),
    '-c:a', 'libmp3lame', '-b:a', BITRATE,
    outFile,
  ])
}

async function main() {
  const files = await collect()
  if (files.length === 0) {
    console.error(
      'raw/bgm/ に音源がありません。\n' +
        '  ダウンロードした音源を raw/bgm/ に置いてから実行してください。',
    )
    process.exit(1)
  }

  // 作り直しなので、前回の出力は消してから始める
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const tmpFile = path.join(os.tmpdir(), `bgm-loop-${process.pid}.wav`)
  const tracks = []
  let done = 0
  for (const name of files) {
    const id = makeId()
    await convert(path.join(srcDir, name), path.join(outDir, `${id}.mp3`), tmpFile)
    tracks.push({ id, src: `audio/bgm/${id}.mp3` })
    done++
    process.stdout.write(`\r  ${done}/${files.length} 曲`)
  }
  process.stdout.write('\n')
  await rm(tmpFile, { force: true })

  const manifest = {
    version: 2,
    loopStart: PAD,
    loopEnd: PAD + LOOP,
    tracks,
  }
  await writeFile(jsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`完了: ${tracks.length}曲 → public/audio/bgm/`)
  console.log(`  ループ ${LOOP}.000秒（動画と同じ周期）`)
  console.log('  一覧: public/audio/bgm.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
