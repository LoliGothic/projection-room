#!/usr/bin/env node
/**
 * BGM を配信用に軽くする。
 *
 *   npm run prep:bgm              raw/bgm を取り込む
 *   npm run prep:bgm -- --sec 60  切り出す長さを変える
 *
 * raw/bgm/ の音源を
 *   先頭から45秒 / 112kbps / 44.1kHz / 前後フェード
 * に揃えて、ランダムなIDで public/audio/bgm/ に書き出し、bgm.json を更新する。
 *
 * 配布元の音源はフル尺で1曲5MB近くある。投稿ごとに曲が変わる作りなので、
 * 1曲を最後まで聴くことはまずない。丸ごと置くと配信物が数百MBになって
 * GitHub Pages に載らなくなるため、頭から使うぶんだけ切り出している。
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'raw', 'bgm')
const outDir = path.join(root, 'public', 'audio', 'bgm')
const jsonPath = path.join(root, 'public', 'audio', 'bgm.json')

/* ---- 配信フォーマット。ここだけ触れば揃う ---- */
/** 切り出す長さ（秒）。動画は10秒なので、数回ループしても足りる長さにしてある */
const DURATION = 45
/** 音量を上げ下げする時間（秒）。曲が切り替わるときの段差を消す */
const FADE_IN = 1
const FADE_OUT = 2
const BITRATE = '112k'
const SAMPLE_RATE = 44100
/* --------------------------------------------- */

const args = process.argv.slice(2)
const secArg = args.indexOf('--sec')
const SEC = secArg >= 0 ? Number(args[secArg + 1]) : DURATION

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

async function convert(input, outFile, seconds) {
  // フェードアウトは終わり際から始める。曲が45秒に満たない場合は
  // afade の開始位置が尺を追い越すが、ffmpeg 側で無視されるので問題ない
  const fadeOutAt = Math.max(0, seconds - FADE_OUT)
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-t', String(seconds),
    '-af', `afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fadeOutAt}:d=${FADE_OUT}`,
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

  const tracks = []
  let done = 0
  for (const name of files) {
    const id = makeId()
    await convert(path.join(srcDir, name), path.join(outDir, `${id}.mp3`), SEC)
    tracks.push({ id, src: `audio/bgm/${id}.mp3` })
    done++
    process.stdout.write(`\r  ${done}/${files.length} 曲`)
  }
  process.stdout.write('\n')

  await writeFile(jsonPath, JSON.stringify({ version: 1, tracks }, null, 2) + '\n', 'utf8')

  console.log(`完了: ${tracks.length}曲 → public/audio/bgm/`)
  console.log('  一覧: public/audio/bgm.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
