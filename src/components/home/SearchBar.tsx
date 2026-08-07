import { Icon } from '../common/Icon'

interface Props {
  readonly value: string
  readonly onChange: (next: string) => void
  /** 지도를 내 위치로 옮기고 목록을 거리순으로 바꾼다 */
  readonly onRecenter: () => void
  readonly canRecenter: boolean
}

// 「내 주변」은 탭이 아니라 버튼이 됐다. 지도가 홈이 되면서 "내 주변"은
// 갈 곳이 아니라 지도에 대고 하는 동작이 됐기 때문이다.
export function SearchBar({ value, onChange, onRecenter, canRecenter }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3">
        <Icon name="search" className="size-4 text-on-surface-variant" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="명소 검색"
          aria-label="명소 검색"
          className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none"
        />
        {value !== '' && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => onChange('')}
            className="text-on-surface-variant"
          >
            <Icon name="close" className="size-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={!canRecenter}
        onClick={onRecenter}
        className={`flex min-h-12 shrink-0 items-center gap-1 rounded-lg px-3 text-label-md font-semibold ${
          canRecenter
            ? 'bg-secondary-container text-primary'
            : 'bg-surface-container text-outline-variant'
        }`}
      >
        <Icon name="near" className="size-4" />
        내 주변
      </button>
    </div>
  )
}
