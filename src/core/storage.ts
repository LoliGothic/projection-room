/**
 * localStorage の読み書き。失敗しても遊べるように必ず握りつぶし、
 * 使えない環境ではメモリ上に保持する。
 */
const memory = new Map<string, string>()

export const KEYS = {
  settings: 'projection-room:settings',
  records: 'projection-room:records',
} as const

function store(): Storage | null {
  try {
    const s = window.localStorage
    const probe = '__pr_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function readRaw(key: string): string | null {
  try {
    return store()?.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

export function writeRaw(key: string, value: string): boolean {
  memory.set(key, value)
  try {
    const s = store()
    if (!s) return false
    s.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key)
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed === null || typeof parsed !== 'object' ? fallback : ({ ...fallback, ...parsed } as T)
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value))
  } catch {
    return false
  }
}
