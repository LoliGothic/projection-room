import { create } from 'zustand'
import type { Stats } from '../core/progress'
import { loadRecords, recordEnding, saveRecords, type Records } from '../core/records'
import { decodeSaveCode, encodeSaveCode } from '../core/saveCode'

interface RecordsStore {
  records: Records
  /** 保存に失敗した（プライベートブラウズなど）。遊べはする */
  saveFailed: boolean
  finishRun: (endingId: string, stats: Stats, escaped: boolean) => void
  exportCode: () => string
  importCode: (code: string) => { ok: boolean; reason?: string }
  reset: () => void
}

export const useRecords = create<RecordsStore>((set, get) => ({
  records: loadRecords(),
  saveFailed: false,

  finishRun: (endingId, stats, escaped) => {
    const records = recordEnding(get().records, endingId, stats, escaped)
    set({ records, saveFailed: !saveRecords(records) })
  },

  exportCode: () => encodeSaveCode(get().records),

  importCode: (code) => {
    const r = decodeSaveCode(code)
    if (!r.ok) return { ok: false, reason: r.reason }
    set({ records: r.records, saveFailed: !saveRecords(r.records) })
    return { ok: true }
  },

  reset: () => {
    const records = loadRecords()
    set({ records, saveFailed: false })
  },
}))
