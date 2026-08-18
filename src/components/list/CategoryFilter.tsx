import { t } from '../../i18n/t'
import { AREA_CATEGORIES, CATEGORY_LABEL } from '../../domain/types'
import type { CategoryFilterValue } from '../../hooks/useNearbyAreas'

// **값은 한국어 그대로다.** 이 배열의 원소는 화면 글자가 아니라 필터 **값**이고,
// 그 값으로 도메인이 명소를 거른다 — 번역하면 필터가 아무것도 못 찾는다.
// 번역은 `labelOf`가 표시할 때만 한다.
const OPTIONS: readonly CategoryFilterValue[] = ['전체', ...AREA_CATEGORIES]

// 「인구밀집지역」·「발달상권」은 행정 용어라 화면에 그대로 쓰지 않는다.
// 필터가 올려보내는 값은 공식 분류 그대로다 — 표시만 바꾼다.
function labelOf(option: CategoryFilterValue): string {
  return option === '전체' ? t('전체') : t(CATEGORY_LABEL[option])
}

interface Props {
  readonly value: CategoryFilterValue
  readonly onChange: (next: CategoryFilterValue) => void
}

export function CategoryFilter({ value, onChange }: Props) {
  return (
    // 탭이 아니라 버튼 묶음인 근거는 `FilterChips`에 한 벌 있다. 정렬 줄과
    // 마찬가지로 예전에는 이름 없는 `tablist`였다.
    <div
      role="group"
      aria-label={t("카테고리")}
      className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
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
