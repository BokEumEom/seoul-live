import { areaDisplayName } from '../../i18n/areaName'
import { t } from '../../i18n/t'
import {
  formatDistance,
  haversineMeters,
  walkableMinutes,
} from '../../domain/distance'
import { CATEGORY_LABEL } from '../../domain/types'
import type { AreaCatalogEntry, CongestionLevel, Coords } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 위치를 아직 못 잡았거나 사용자가 거부하면 null. */
  readonly coords: Coords | null
  /** 혼잡도 응답이 오기 전에는 undefined다. null을 넘기면 배지가 「정보 없음」을
   *  띄우는데, 로딩 중에 그건 사실이 아니다. */
  readonly level: CongestionLevel | undefined
}

// Google Maps 장소 카드의 히어로 순서다 — 이름, 카테고리·거리·도보 시간,
// 그리고 오른쪽에 상태 배지.
export function AreaHero({ entry, coords, level }: Props) {
  // 도보 시간은 domain/distance가 유일한 출처다. 여기서 다시 환산하면
  // RecommendationCard와 조용히 갈리고, 상한도 자리마다 달라진다.
  const distanceMeters = coords === null ? null : haversineMeters(coords, entry)
  const walkMinutes = distanceMeters === null ? null : walkableMinutes(distanceMeters)

  return (
    <div className="flex items-start justify-between gap-3 px-4">
      <div className="min-w-0">
        {/* `truncate`가 아니라 `line-clamp-2`다. 한 줄로 자르면 **영어 이름이
            잘린다** — 한국어는 「홍대입구역(2호선)」까지 한 줄에 들어가지만
            영어는 「Hongik Univ. Station (…」로 끊겨 어느 역인지 못 읽었다.
            한국어 30곳은 전부 한 줄이라 이 바꿈으로 달라지는 것이 없고, 긴
            영어 이름만 두 줄을 쓴다. 두 줄까지인 것은 이름이 카드 하나를
            통째로 먹지 않게 하려는 것이다. */}
        <h2 className="line-clamp-2 text-headline-md text-on-surface">
          {areaDisplayName(entry)}
        </h2>
        {/* `!== null`이지 truthy 검사가 아니다. 명소 위에 서 있으면 거리가
            0이라 `distanceMeters &&`로 쓰면 이 줄이 카테고리만 남는다. */}
        <p className="mt-0.5 text-label-sm text-on-surface-variant">
          {t(CATEGORY_LABEL[entry.category])}
          {distanceMeters !== null && ` · ${formatDistance(distanceMeters)}`}
          {walkMinutes !== null && ` `}
          {walkMinutes !== null && t('· 도보 {분}분', { 분: walkMinutes })}
        </p>
      </div>
      {level !== undefined && <CongestionBadge level={level} />}
    </div>
  )
}
