import { useEffect, useRef, useState } from 'react'
import type { Dread } from '../core/dread'
import { noticeIntervalMs } from '../core/dread'
import { DREAD, FX } from '../config/tuning'
import { DREAD_NOTICES } from '../config/feed.data'

export interface Notice {
  id: number
  text: string
}

/** 出てから引っ込むまで */
const NOTICE_LIFE_MS = 4200

/**
 * 不穏タイマーに合わせて通知を降らせる。
 * 強さが上がるほど間隔が短くなる。「演出を弱める」ときは数も間隔も控えめにする。
 *
 * resetKey が変わると、それまでの通知は消える（次の動画に持ち越さない）。
 */
export function useDreadNotices(
  dread: Dread,
  active: boolean,
  softened: boolean,
  resetKey: number,
): Notice[] {
  const [state, setState] = useState<{ key: number; notices: Notice[] }>({
    key: resetKey,
    notices: [],
  })
  const nextId = useRef(0)
  // 強さは毎フレーム変わるので、タイマーを張り替えずに読めるよう ref で持つ
  const dreadRef = useRef(dread)

  useEffect(() => {
    dreadRef.current = dread
  })

  useEffect(() => {
    if (!active) return

    let timer = 0
    let alive = true

    const schedule = () => {
      const d = dreadRef.current
      if (d.intensity <= 0) {
        // まだ静かな時間帯。少し待ってから見直す
        timer = window.setTimeout(schedule, 1000)
        return
      }
      const wait = noticeIntervalMs(d, DREAD.notifyIntervalMs) * (softened ? 1.8 : 1)
      timer = window.setTimeout(() => {
        if (!alive) return
        const max = softened ? 1 : FX.maxNotifications
        const notice = {
          id: nextId.current,
          text: DREAD_NOTICES[nextId.current % DREAD_NOTICES.length],
        }
        nextId.current++
        setState((prev) => ({
          key: resetKey,
          notices: [...(prev.key === resetKey ? prev.notices : []), notice].slice(-max),
        }))
        window.setTimeout(() => {
          if (!alive) return
          setState((prev) => ({ ...prev, notices: prev.notices.filter((n) => n.id !== notice.id) }))
        }, NOTICE_LIFE_MS)
        schedule()
      }, wait)
    }

    schedule()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [active, softened, resetKey])

  return active && state.key === resetKey ? state.notices : []
}
