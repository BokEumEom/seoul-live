export type TabKey = 'map' | 'nearby' | 'forecast' | 'more'

interface Tab {
  readonly key: TabKey
  readonly label: string
  readonly icon: string
  readonly enabled: boolean
}

// 지도와 더보기는 1차 범위 밖이다. 시안의 4탭 구조는 유지하되 비활성으로 둔다.
const TABS: readonly Tab[] = [
  { key: 'map', label: '지도', icon: '🗺️', enabled: false },
  { key: 'nearby', label: '내 주변', icon: '📍', enabled: true },
  { key: 'forecast', label: '혼잡예보', icon: '📈', enabled: true },
  { key: 'more', label: '더보기', icon: '⋯', enabled: false },
]

interface Props {
  readonly active: TabKey
  readonly onSelect: (key: TabKey) => void
}

export function BottomTabBar({ active, onSelect }: Props) {
  return (
    <nav className="sticky bottom-0 flex border-t border-outline-variant bg-surface-container-lowest">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={!tab.enabled}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onSelect(tab.key)}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
            active === tab.key
              ? 'text-primary'
              : tab.enabled
                ? 'text-on-surface-variant'
                : 'text-outline-variant'
          }`}
        >
          <span aria-hidden>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
