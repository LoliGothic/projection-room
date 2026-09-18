#!/usr/bin/env node
/**
 * PWA 用のアイコンを ffmpeg で生成する（映写機のリール）。
 *   npm run gen:icons
 */
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'icons')

const SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-maskable-512.png', padding: 0.78 },
  { size: 180, name: 'apple-touch-icon.png' },
]

/** リールの形を作る式（1 = 線の色、0 = 背景） */
function reelExpr(size, padding) {
  const c = size / 2
  const R = (size / 2) * padding
  const ring = R * 0.92
  const ringW = R * 0.12
  const hub = R * 0.2
  const spokeW = R * 0.09
  const spokeIn = R * 0.3
  const spokeOut = R * 0.78
  const d = `hypot(X-${c},Y-${c})`

  const onRing = `lt(abs(${d}-${ring}),${ringW})`
  const onHub = `lt(${d},${hub})`
  const inBand = `between(${d},${spokeIn},${spokeOut})`
  const spokeV = `lt(abs(X-${c}),${spokeW})`
  const spokeH = `lt(abs(Y-${c}),${spokeW})`
  const spokeD1 = `lt(abs((X-${c})-(Y-${c})),${spokeW * 1.4})`
  const spokeD2 = `lt(abs((X-${c})+(Y-${c})),${spokeW * 1.4})`
  const spokes = `(${inBand})*((${spokeV})+(${spokeH})+(${spokeD1})+(${spokeD2}))`

  return `clip((${onRing})+(${onHub})+(${spokes}),0,1)`
}

async function main() {
  await mkdir(outDir, { recursive: true })

  for (const { size, name, padding = 0.9 } of SIZES) {
    const v = reelExpr(size, padding)
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi',
      '-i', `color=c=#0A0908:s=${size}x${size}`,
      '-vf', [
        'format=rgb24',
        `geq=r='10+206*(${v})':g='9+171*(${v})':b='8+98*(${v})'`,
      ].join(','),
      '-frames:v', '1',
      path.join(outDir, name),
    ])
    console.log(`  ${name} (${size}x${size})`)
  }
  console.log('アイコンを public/icons/ に生成しました')
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err)
  process.exit(1)
})
