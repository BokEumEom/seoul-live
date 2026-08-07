import { AREA_CATEGORIES, CATEGORY_LABEL } from '../../domain/types'
import type { CategoryFilterValue } from '../../hooks/useNearbyAreas'

const OPTIONS: readonly CategoryFilterValue[] = ['전체', ...AREA_CATEGORIES]

// 「인구밀집지역」·「발달상권」은 행정 용어라 화면에 그대로 쓰지 않는다.
// 필터가 올려보내는 값은 공식 분류 그대로다 — 표시만 바꾼다.
function labelOf(option: CategoryFilterValue): string {
  return option === '전체' ? '전체' : CATEGORY_LABEL[option]
}

interface Props {
  readonly value: CategoryFilterValue
  readonly onChange: (next: CategoryFilterValue) => void
}

export function CategoryFilter({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-1" role="tablist">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={`min-h-12 shrink-0 rounded-full px-4 text-label-md font-semibold ${
            value === option
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          {labelOf(option)}
        </button>
      ))}
    </div>
  )
}
