import type { ReactNode } from 'react'
import { Icon } from '../common/Icon'

interface Props {
  readonly title: string
  readonly onBack?: () => void
  readonly trailing?: ReactNode
}

// DESIGN.md의 Glassmorphism: 상단 헤더는 블러로 아래 내용이 비쳐 보이게 한다.
export function TopAppBar({ title, onBack, trailing }: Props) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-outline-variant bg-surface/80 px-4 backdrop-blur-md">
      {onBack !== undefined && (
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="grid size-10 shrink-0 place-items-center rounded-full text-on-surface"
        >
          <Icon name="back" />
        </button>
      )}
      <h1 className="flex-1 truncate text-headline-sm text-primary">{title}</h1>
      {trailing}
    </header>
  )
}
