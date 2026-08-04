import { formatDistance } from '../../domain/distance'
import type { NearbyArea } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'

interface Props {
  readonly area: NearbyArea
  readonly onSelect: (name: string) => void
}

export function AreaListItem({ area, onSelect }: Props) {
  const { entry, snapshot, distanceMeters } = area

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.name)}
      className="flex min-h-16 w-full items-center gap-3 rounded-card border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-on-surface">{entry.name}</p>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          {distanceMeters !== null && (
            <span className="font-semibold text-primary">
              {formatDistance(distanceMeters)} ·{' '}
            </span>
          )}
          {entry.category}
          {snapshot !== null && ` · ${snapshot.observedAtLabel} 기준`}
        </p>
      </div>
      <CongestionBadge level={snapshot?.congestion ?? null} />
    </button>
  )
}
