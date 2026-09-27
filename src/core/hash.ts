/**
 * 文字列から 0以上1未満の値を作る。
 *
 * 見た目の飾り（コメント・数字・投稿者名）を「動画ごとに決まっているが規則性は無い」
 * 状態にするために使う。本物か AI かは一切見ていない。
 *
 * FNV-1a のあとに撹拌を入れている。これが無いと、末尾 1 文字しか違わない入力
 * （c0, c1, c2 …）の差が上位ビットに伝わらず、続けて引くと同じ値ばかりになる。
 */
export function unitHash(...parts: readonly string[]): number {
  let h = 2166136261
  const text = parts.join(':')
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // 撹拌（murmur3 の仕上げ）
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 配列から 1 つ選ぶ */
export function pickBy<T>(items: readonly T[], ...parts: readonly string[]): T {
  return items[Math.floor(unitHash(...parts) * items.length) % items.length]
}
