import type { SortMode } from '../../hooks/useNearbyAreas'

// 리터럴 배열로 둔다. Tailwind v4는 정적 추출이라 클래스를 조합하지 않는다.
const OPTIONS: readonly { readonly mode: SortMode; readonly label: string }[] = [
  { mode: 'distance', label: '거리순' },
  { mode: 'calm', label: '여유한 순' },
  { mode: 'busy', label: '붐비는 순' },
]

interface Props {
  readonly value: SortMode
  /** 좌표가 없으면 거리순을 고를 수 없다 */
  readonly canSortByDistance: boolean
  readonly onChange: (next: SortMode) => void
}

// 토글 버튼 하나로는 셋을 표현할 수 없어 SortSelect를 대체한다. 선택지가
// 둘일 때는 메뉴를 여는 탭 한 번이 낭비였지만, 셋부터는 지금 무엇이 골라져
// 있는지 한눈에 보이는 쪽이 낫다.
export function SortSegmented({ value, canSortByDistance, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-full bg-surface-container p-1" role="tablist">
      {OPTIONS.map((option) => {
        const disabled = option.mode === 'distance' && !canSortByDistance
        return (
          <button
            key={option.mode}
            type="button"
            role="tab"
            disabled={disabled}
            aria-selected={value === option.mode}
            onClick={() => onChange(option.mode)}
            className={`min-h-10 flex-1 rounded-full px-3 text-label-md font-semibold ${
              value === option.mode
                ? 'bg-surface-container-lowest text-primary shadow-floating'
                : disabled
                  ? 'text-outline-variant'
                  : 'text-on-surface-variant'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
