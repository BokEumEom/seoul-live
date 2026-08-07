import { Icon, type IconName } from '../common/Icon'

export type TabKey = 'map' | 'nearby' | 'forecast' | 'more'

interface Tab {
  readonly key: TabKey
  readonly label: string
  readonly icon: IconName
  readonly enabled: boolean
}

// 시안의 4탭이 전부 활성이다. `enabled`는 남겨둔다 — 탭이 늘어날 때 준비 중인
// 화면을 비활성으로 두는 경로가 다시 필요해진다.
const TABS: readonly Tab[] = [
  { key: 'map', label: '지도', icon: 'map', enabled: true },
  { key: 'nearby', label: '내 주변', icon: 'near', enabled: true },
  { key: 'forecast', label: '혼잡예보', icon: 'forecast', enabled: true },
  { key: 'more', label: '더보기', icon: 'more', enabled: true },
]

interface Props {
  readonly active: TabKey
  readonly onSelect: (key: TabKey) => void
}

export function BottomTabBar({ active, onSelect }: Props) {
  return (
    <nav className="sticky bottom-0 flex bg-surface-container-lowest shadow-floating">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={!tab.enabled}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onSelect(tab.key)}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-label-sm"
        >
          {/* 활성 탭은 시안처럼 아이콘 뒤에 알약 모양 배경을 깐다. */}
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full ${
              active === tab.key
                ? 'bg-secondary-container text-primary'
                : tab.enabled
                  ? 'text-on-surface-variant'
                  : 'text-outline-variant'
            }`}
          >
            <Icon name={tab.icon} className="size-5" />
          </span>
          <span
            className={
              active === tab.key
                ? 'text-primary'
                : tab.enabled
                  ? 'text-on-surface-variant'
                  : 'text-outline-variant'
            }
          >
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
