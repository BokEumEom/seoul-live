import { formatDistance } from '../../domain/distance'
import type { NearbyArea } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'
import { Icon } from '../common/Icon'

interface Props {
  readonly area: NearbyArea
  readonly onSelect: (name: string) => void
}

// DESIGN.md의 Cards 규격: 이름(headline-sm) · 혼잡도 칩 · 갱신 시각(label-sm).
export function AreaListItem({ area, onSelect }: Props) {
  const { entry, snapshot, distanceMeters } = area

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.name)}
      className="flex min-h-16 w-full items-center gap-3 rounded-card border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-headline-sm text-on-surface">{entry.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-label-md text-on-surface-variant">
          {distanceMeters !== null && (
            <>
              <Icon name="near" className="size-4 text-primary" />
              <span className="font-bold text-primary">
                {formatDistance(distanceMeters)}
              </span>
            </>
          )}
          <span>{entry.category}</span>
          {snapshot !== null && (
            <span className="text-label-sm text-outline">
              · {snapshot.observedAtLabel} 기준
            </span>
          )}
        </p>
      </div>
      <CongestionBadge level={snapshot?.congestion ?? null} />
    </button>
  )
}
