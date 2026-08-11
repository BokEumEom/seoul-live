import {
  CATEGORY_LABEL,
  type AreaCategory,
  type CongestionLevel,
} from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'

interface Props {
  readonly rows: readonly {
    readonly category: AreaCategory
    readonly level: CongestionLevel
  }[]
}

export function CategoryAverages({ rows }: Props) {
  if (rows.length === 0) return null

  return (
    <section className="mx-4 mt-3 rounded-card bg-surface-container-lowest p-4">
      <h3 className="text-headline-sm text-on-surface">카테고리별 평균</h3>
      <ul className="mt-2">
        {rows.map((row) => (
          <li key={row.category} className="flex items-center justify-between py-1.5">
            <span className="text-body-md text-on-surface">
              {CATEGORY_LABEL[row.category]}
            </span>
            <CongestionBadge level={row.level} />
          </li>
        ))}
      </ul>
    </section>
  )
}
