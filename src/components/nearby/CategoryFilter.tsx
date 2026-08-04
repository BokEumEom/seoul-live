import type { CategoryFilterValue } from '../../hooks/useNearbyAreas'

const OPTIONS: readonly CategoryFilterValue[] = [
  '전체',
  '공원',
  '쇼핑몰',
  '카페',
  '문화재',
  '기타',
]

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
          {option}
        </button>
      ))}
    </div>
  )
}
