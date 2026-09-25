interface Props {
  notices: readonly { id: number; text: string }[]
}

/** 画面上部から降りてくる通知 */
export function Notifications({ notices }: Props) {
  if (notices.length === 0) return null
  return (
    <div className="notifications" aria-live="polite">
      {notices.map((n) => (
        <p key={n.id} className="notification">
          {n.text}
        </p>
      ))}
    </div>
  )
}
