import { Icon } from '../common/Icon'

interface Props {
  readonly value: string
  readonly onChange: (next: string) => void
}

// 검색만 한다. 「내 주변」은 지도 위 FAB(`RecenterButton`)이 흡수했다 —
// 지도가 화면 전체가 되면서 그것은 검색 줄에 얹을 일이 아니라 지도에 대고
// 하는 동작이 됐고, 지도 위에 떠 있어야 무엇에 대한 동작인지가 보인다.
export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center px-4 py-2">
      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 shadow-floating">
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
    </div>
  )
}
