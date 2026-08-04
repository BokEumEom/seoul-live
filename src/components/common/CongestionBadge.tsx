import { congestionTone, type CongestionTone } from '../../domain/congestion'
import type { CongestionLevel } from '../../domain/types'

// Tailwind v4는 클래스명을 정적으로 추출한다. `bg-${tone}-container` 같은 동적 조합은
// 빌드에서 사라지므로 전체 클래스명을 리터럴로 적어야 한다.
const TONE_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm-container text-calm',
  normal: 'bg-normal-container text-normal',
  busy: 'bg-busy-container text-busy',
  crowded: 'bg-crowded-container text-crowded',
}

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
