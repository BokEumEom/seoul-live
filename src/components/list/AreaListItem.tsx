import { formatDistance } from '../../domain/distance'
import { CATEGORY_LABEL, type NearbyArea } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'
import { Icon } from '../common/Icon'

interface Props {
  readonly area: NearbyArea
  readonly favorite?: boolean
  readonly onSelect: (name: string) => void
}

// 카드가 아니라 구분선 목록이다. 시트가 좁은 창이라 한 화면에 몇 줄이
// 들어가는지가 곧 쓸모다 — 카드 테두리와 12px 간격은 두 줄어치를 먹는다.
// 갱신 시각은 시트 상단 요약과 명소 상세에 있으므로 여기서는 뺀다.
export function AreaListItem({ area, favorite = false, onSelect }: Props) {
  const { entry, snapshot, distanceMeters } = area

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.name)}
      className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-outline-variant py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body-md font-semibold text-on-surface">
            {entry.name}
          </span>
          {favorite && (
            <span aria-label="즐겨찾기" className="shrink-0 text-primary">
              <Icon name="starFilled" className="size-4" />
            </span>
          )}
        </span>
        {/* `!== null`이지 truthy 검사가 아니다. 명소 위에 서 있으면 거리가 0이고,
            `distanceMeters &&`로 쓰면 거리 대신 숫자 0이 그려진다. */}
        <span className="mt-0.5 block truncate text-label-sm text-on-surface-variant">
          {distanceMeters !== null && `${formatDistance(distanceMeters)} · `}
          {CATEGORY_LABEL[entry.category]}
        </span>
      </span>
      <CongestionBadge level={snapshot?.congestion ?? null} />
    </button>
  )
}
