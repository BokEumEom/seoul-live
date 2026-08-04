import { formatDistance, walkingMinutes } from '../../domain/distance'
import type { NearbyArea } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'
import { Icon } from '../common/Icon'

interface Props {
  readonly area: NearbyArea
  readonly onSelect: (name: string) => void
}

// 시안의 추천 카드에는 명소 사진이 들어가지만 서울 API는 이미지를 주지 않는다.
// 사진 자산이 준비되기 전까지는 텍스트 중심으로 두고, 목록 행과 구분되도록
// 폭 고정 + 가로 스크롤로 배치한다.
export function RecommendationCard({ area, onSelect }: Props) {
  const { entry, snapshot, distanceMeters } = area

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.name)}
      className="flex w-56 shrink-0 snap-start flex-col gap-2 rounded-card border border-outline-variant bg-surface-container-lowest p-4 text-left"
    >
      <CongestionBadge level={snapshot?.congestion ?? null} />
      <p className="truncate text-headline-sm text-on-surface">{entry.name}</p>
      {distanceMeters !== null && (
        <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
          <Icon name="near" className="size-4 text-primary" />
          <span className="font-bold text-primary">
            {formatDistance(distanceMeters)}
          </span>
          <span>· 도보 {walkingMinutes(distanceMeters)}분</span>
        </p>
      )}
      {snapshot !== null && (
        <p className="text-label-sm text-outline">
          {snapshot.observedAtLabel} 업데이트됨
        </p>
      )}
    </button>
  )
}
