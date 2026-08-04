import type { ReactNode } from 'react'

interface Props {
  readonly title: string
  readonly onBack?: () => void
  readonly trailing?: ReactNode
}

export function TopAppBar({ title, onBack, trailing }: Props) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-outline-variant bg-surface/80 px-4 backdrop-blur-md">
      {onBack !== undefined && (
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="grid size-10 shrink-0 place-items-center rounded-full text-xl text-on-surface"
        >
          ←
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-bold text-primary">{title}</h1>
      {trailing}
    </header>
  )
}
