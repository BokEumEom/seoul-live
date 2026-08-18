import { areaDisplayName } from '../../i18n/areaName'
import { t } from '../../i18n/t'
import { CATEGORY_LABEL, type NearbyArea } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'

interface Props {
  readonly title: string
  readonly areas: readonly NearbyArea[]
  readonly onSelect: (name: string) => void
}

export function RankList({ title, areas, onSelect }: Props) {
  if (areas.length === 0) return null

  return (
    <section className="mx-4 mt-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      <ul className="mt-2">
        {areas.map((area, index) => (
          <li key={area.entry.code}>
            <button
              type="button"
              onClick={() => onSelect(area.entry.name)}
              className="flex min-h-12 w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-label-sm text-outline">{index + 1}</span>
                <span className="truncate text-body-md text-on-surface">
                  {areaDisplayName(area.entry)}
                </span>
                <span className="shrink-0 text-label-sm text-on-surface-variant">
                  {t(CATEGORY_LABEL[area.entry.category])}
                </span>
              </span>
              <CongestionBadge level={area.snapshot?.congestion ?? null} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
