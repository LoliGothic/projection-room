import type { Clip, ClipsFile } from '../core/types'

/**
 * clips.json は 'clips/xxx.mp4' の相対パスで src を持つ。
 * 配信先（ルート / サブパス）に依らず解決できるよう、実行時に BASE_URL と連結する。
 */
export function resolveClipSrc(src: string): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('/')) return src
  return import.meta.env.BASE_URL + src.replace(/^\.?\//, '')
}

export async function loadClips(): Promise<Clip[]> {
  const res = await fetch(import.meta.env.BASE_URL + 'clips.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`clips.json を読み込めませんでした (${res.status})`)
  const data = (await res.json()) as ClipsFile
  if (!Array.isArray(data.clips) || data.clips.length === 0) {
    throw new Error('clips.json に動画が登録されていません')
  }
  return data.clips.map((c) => ({ ...c, src: resolveClipSrc(c.src) }))
}
