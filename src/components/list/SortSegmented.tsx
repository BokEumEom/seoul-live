import { t } from '../../i18n/t'
import type { SortMode } from '../../hooks/useNearbyAreas'

// 리터럴 배열로 둔다. Tailwind v4는 정적 추출이라 클래스를 조합하지 않는다.
const OPTIONS: readonly { readonly mode: SortMode; readonly label: string }[] = [
  { mode: 'distance', label: t('거리순') },
  { mode: 'calm', label: t('여유한 순') },
  { mode: 'busy', label: t('붐비는 순') },
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
    // 탭이 아니라 버튼 묶음인 근거는 `FilterChips`에 한 벌 있다. 이름이 함께
    // 붙는 이유: 예전에는 이름 없는 `tablist`라 보조기술이 「탭 목록」이라고만
    // 알리고 무엇을 고르는 줄인지 말하지 못했다.
    <div
      role="group"
      aria-label={t("정렬")}
      className="flex gap-1 rounded-full bg-surface-container p-1"
    >
      {OPTIONS.map((option) => {
        const disabled = option.mode === 'distance' && !canSortByDistance
        return (
          <button
            key={option.mode}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.mode}
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
