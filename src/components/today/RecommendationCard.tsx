import { t } from '../../i18n/t'
import { formatDistance, walkableMinutes } from '../../domain/distance'
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

  // `walkingMinutes`(상한 없음)가 아니라 `walkableMinutes`(60분 상한)다.
  // 「걸어갈 만한 거리인가」는 도메인이 갖는 판정이고 `AreaHero`도 이걸 쓴다 —
  // 여기만 상한 없는 쪽을 쓰면 같은 값이 자리마다 다르게 잘린다.
  //
  // 지금은 `pickRecommendations`가 반경을 막아 null이 나올 수 없다. 그렇다고
  // 죽은 가지가 아니다: 반경이 늘어나는 날 `AreaHero`는 그대로인데 여기만
  // 「도보 160분」을 적게 되는 것을 이 한 줄이 막는다.
  const walkMinutes = distanceMeters === null ? null : walkableMinutes(distanceMeters)

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
          {walkMinutes !== null && <span>{t('· 도보 {분}분', { 분: walkMinutes })}</span>}
        </p>
      )}
      {snapshot !== null && (
        <p className="text-label-sm text-outline">
          {t('{시각} 업데이트됨', { 시각: snapshot.observedAtLabel })}
        </p>
      )}
    </button>
  )
}
