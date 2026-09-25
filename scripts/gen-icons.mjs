#!/usr/bin/env node
/**
 * PWA 用のアイコンを ffmpeg で生成する。
 *   npm run gen:icons
 *
 * 再生ボタンの三角と、少しずれて重なるもう一つの三角。
 * 実在のアプリのロゴには似せない。
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
  { size: 512, name: 'icon-maskable-512.png', padding: 0.7 },
  { size: 180, name: 'apple-touch-icon.png' },
]

/** 三角形（右向き）の内側かどうかを表す式 */
function triangle(size, padding, dx, dy) {
  const c = size / 2
  const r = (size / 2) * padding
  const left = c - r * 0.55 + dx
  const right = c + r * 0.75 + dx
  const top = c - r * 0.8 + dy
  const bottom = c + r * 0.8 + dy
  // 左辺より右、かつ上下の斜辺の内側
  const inX = `gte(X,${left})*lte(X,${right})`
  const t = `((X-${left})/(${right - left}))`
  const halfH = `((1-${t})*${(bottom - top) / 2})`
  const inY = `lte(abs(Y-${(top + bottom) / 2}),${halfH})`
  return `(${inX})*(${inY})`
}

async function main() {
  await mkdir(outDir, { recursive: true })

  for (const { size, name, padding = 0.86 } of SIZES) {
    const main = triangle(size, padding, 0, 0)
    const ghost = triangle(size, padding, size * 0.09, -size * 0.06)

    // 本体は明るい色、ずれた影は暗く。重なった部分は本体を優先する
    const v = `clip(${main},0,1)`
    const g = `clip((${ghost})*(1-${main}),0,1)`

    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi',
      '-i', `color=c=#0A0A0E:s=${size}x${size}`,
      '-vf', [
        'format=rgb24',
        `geq=` +
          `r='10+99*(${v})+40*(${g})':` +
          `g='10+214*(${v})+60*(${g})':` +
          `b='14+190*(${v})+70*(${g})'`,
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
