/**
 * 先読み用に <video> 要素を使い回すためのスロット割り当て。
 *
 * 要素を作り直すと iOS で読み込みが詰まるため、固定数のスロットを用意して
 * 「表示中の1本 + 先読み分」を順に割り当てる。
 *
 * 回答するたびに先頭が 1 本ずつ進むので、割り当ては
 * 「これまでに回答した本数（turn）」だけから決まる。履歴を持つ必要はない。
 */

export function slotFor(turn: number, offset: number, slotCount: number): number {
  const n = (turn + offset) % slotCount
  return n < 0 ? n + slotCount : n
}

/**
 * ids は「上へ抜けた1本 → 表示中の1本 → 先読み」の順に並べる。
 * まだ前の1本が無いときは undefined を入れておけば、その枠を空けたまま割り当てる。
 * 戻り値は「スロット番号 → 動画ID」の配列。
 */
export function buildSlots(
  turn: number,
  ids: readonly (string | null | undefined)[],
  slotCount: number,
): (string | null)[] {
  const slots: (string | null)[] = new Array(slotCount).fill(null)
  ids.slice(0, slotCount).forEach((id, offset) => {
    if (!id) return
    slots[slotFor(turn, offset, slotCount)] = id
  })
  return slots
}
