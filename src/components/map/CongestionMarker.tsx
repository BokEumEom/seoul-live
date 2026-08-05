import { congestionTone, type CongestionTone } from '../../domain/congestion'
import type { CongestionLevel } from '../../domain/types'
import { Icon } from '../common/Icon'

// Tailwind v4는 클래스명을 정적으로 추출한다. `bg-${tone}` 같은 동적 조합은
// 빌드에서 사라지므로 전체 클래스명을 리터럴로 적는다. CongestionBadge의
// TONE_CLASS와 같은 제약이다.
const TONE_PILL_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm text-white',
  normal: 'bg-normal text-white',
  busy: 'bg-busy text-white',
  crowded: 'bg-crowded text-white',
}

const TONE_PIN_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'text-calm',
  normal: 'text-normal',
  busy: 'text-busy',
  crowded: 'text-crowded',
}

const UNKNOWN_LABEL = '정보 없음'
const UNKNOWN_PILL_CLASS = 'bg-surface-container-high text-on-surface-variant'
const UNKNOWN_PIN_CLASS = 'text-outline'

interface Props {
  readonly name: string
  readonly level: CongestionLevel | null
  /** 줌이 낮으면 알약 라벨을 감춘다. `domain/map.shouldShowMarkerLabel` 참고. */
  readonly showLabel: boolean
  readonly selected: boolean
}

// AdvancedMarker가 씌우는 내용물이다. 이 컴포넌트는 SDK를 import하지 않는다 —
// 그래야 색상·라벨 규칙을 지도 목업 없이 테스트할 수 있다.
export function CongestionMarker({ name, level, showLabel, selected }: Props) {
  const tone = level === null ? null : congestionTone(level)
  const pillClass = tone === null ? UNKNOWN_PILL_CLASS : TONE_PILL_CLASS[tone]
  const pinClass = tone === null ? UNKNOWN_PIN_CLASS : TONE_PIN_CLASS[tone]
  const label = level ?? UNKNOWN_LABEL

  return (
    <span
      role="img"
      aria-label={`${name} ${label}`}
      className="flex flex-col items-center"
    >
      {showLabel && (
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm font-semibold shadow-floating ${pillClass}`}
        >
          {label}
        </span>
      )}
      <Icon
        name="pin"
        className={`${selected ? 'size-9' : 'size-7'} ${pinClass}`}
      />
    </span>
  )
}
