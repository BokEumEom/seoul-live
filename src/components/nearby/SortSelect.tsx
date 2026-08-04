import type { SortMode } from '../../hooks/useNearbyAreas'
import { Icon } from '../common/Icon'

const LABEL: Readonly<Record<SortMode, string>> = {
  distance: '거리순',
  congestion: '혼잡도순',
}

interface Props {
  readonly value: SortMode
  readonly onChange: (next: SortMode) => void
  /** 좌표가 없으면 거리순은 고를 수 없다. */
  readonly distanceAvailable: boolean
}

// 선택지가 둘뿐이라 드롭다운 대신 토글 버튼 하나로 둔다. 시안은 "정렬 기준 ˅"
// 형태지만, 항목이 두 개인 메뉴를 열게 하는 건 탭 한 번을 괜히 늘리는 일이다.
export function SortSelect({ value, onChange, distanceAvailable }: Props) {
  if (!distanceAvailable) {
    return (
      <span className="text-label-md text-outline">혼잡도순</span>
    )
  }

  return (
    <button
      type="button"
      onClick={() =>
        onChange(value === 'distance' ? 'congestion' : 'distance')
      }
      aria-label={`정렬 기준: ${LABEL[value]}. 눌러서 바꾸기`}
      className="flex min-h-12 items-center gap-0.5 text-label-md font-semibold text-primary"
    >
      {LABEL[value]}
      <Icon name="chevronDown" className="size-4" />
    </button>
  )
}
