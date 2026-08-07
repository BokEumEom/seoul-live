import { congestionTone } from '../../domain/congestion'
import type { CongestionLevel } from '../../domain/types'
import { TONE_CLASS } from './toneClass'

interface Props {
  readonly level: CongestionLevel | null
  /** 상세 화면 상단처럼 강조가 필요한 자리에서 쓴다. */
  readonly emphasis?: boolean
}

// DESIGN.md의 Chips 규격: 색점 + 텍스트, 완전한 라운드.
export function CongestionBadge({ level, emphasis = false }: Props) {
  const size = emphasis ? 'px-3 py-1.5 text-label-md' : 'px-2.5 py-1 text-label-sm'

  if (level === null) {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container text-on-surface-variant ${size}`}
      >
        정보 없음
      </span>
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full ${size} ${TONE_CLASS[congestionTone(level)]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {emphasis ? `지금은 ${level}` : level}
    </span>
  )
}
