interface Props {
  /** ゆっくり通る個体にする */
  slow?: boolean
}

/**
 * 上下の余白を、数分に一度だけ横切る人影。
 * 発生間隔は CSS アニメーションの長さで決めているので JS は動かない。
 */
export function CrossingShadow({ slow = false }: Props) {
  return (
    <svg className={slow ? 'crosser slow' : 'crosser'} viewBox="0 0 60 70" aria-hidden="true">
      <ellipse cx="30" cy="16" rx="10" ry="12" />
      <path d="M30 28 C14 28 7 43 5 70 L55 70 C53 43 46 28 30 28 Z" />
    </svg>
  )
}
