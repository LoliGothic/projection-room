import type { Stats } from './progress'
import { averageReplays } from './progress'
import {
  ENDINGS,
  type Condition,
  type EndingDef,
  type StatKey,
  type Trigger,
} from '../config/endings.data'

export function statValue(stats: Stats, key: StatKey): number {
  if (key === 'avgReplays') return averageReplays(stats)
  return stats[key]
}

export function matches(stats: Stats, c: Condition): boolean {
  const v = statValue(stats, c.stat)
  switch (c.op) {
    case 'lt':
      return v < c.value
    case 'lte':
      return v <= c.value
    case 'gt':
      return v > c.value
    case 'gte':
      return v >= c.value
    case 'eq':
      return v === c.value
  }
}

/**
 * 統計ときっかけからエンディングを決める。
 * priority の小さいものから見て、条件をすべて満たした最初の 1 つ。
 */
export function resolveEnding(
  stats: Stats,
  trigger: Trigger,
  defs: readonly EndingDef[] = ENDINGS,
): EndingDef | undefined {
  return [...defs]
    .filter((d) => d.trigger === trigger)
    .sort((a, b) => a.priority - b.priority)
    .find((d) => d.conditions.every((c) => matches(stats, c)))
}
