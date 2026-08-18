import { areaDisplayName } from '../../i18n/areaName'
import { t } from '../../i18n/t'
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
//
// 밀도를 위해 내준 것: 예전에는 거리를 `text-primary font-bold` + 아이콘으로
// 강조해 "가까운 순" 정렬에서 눈이 걸 앵커가 됐는데, 지금은 거리와 카테고리가
// 같은 색·굵기의 한 줄이다. 강조를 되살리면 그 줄이 다시 두 줄이 된다.
// 의도된 교환이지 빠뜨린 게 아니다.
export function AreaListItem({ area, favorite = false, onSelect }: Props) {
  const { entry, snapshot, distanceMeters } = area

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.name)}
      className="flex min-h-12 w-full items-center gap-3 border-b border-outline-variant py-2 text-left last:border-b-0"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {/* `onSelect`에는 `entry.name`(한국어)이 그대로 간다 — 그건 호출
              키다. 눈에 보이는 글자만 바뀐다. */}
          <span className="truncate text-body-md font-semibold text-on-surface">
            {areaDisplayName(entry)}
          </span>
          {/* `role="img"`은 장식이 아니다. role 없는 `<span>`은 `generic`이고
              ARIA 1.2에서 generic은 이름을 받을 수 없어("Name from author:
              prohibited") Chromium·Firefox가 `aria-label`을 버린다. 안쪽 svg는
              `aria-hidden`이라 그러면 즐겨찾기 표시가 통째로 사라진다.
              문구도 "즐겨찾기"가 아니라 "즐겨찾기한 곳"이다 — 이 버튼은 상세로
              가는 버튼이라 동작이 아니라 상태로 읽혀야 한다. 진짜 토글은
              `AreaDetail`에 따로 있다. */}
          {favorite && (
            <span
              role="img"
              aria-label={t("즐겨찾기한 곳")}
              className="shrink-0 text-primary"
            >
              <Icon name="starFilled" className="size-4" />
            </span>
          )}
        </span>
        {/* `!== null`이지 truthy 검사가 아니다. 명소 위에 서 있으면 거리가 0이고,
            `distanceMeters &&`로 쓰면 거리 대신 숫자 0이 그려진다. */}
        <span className="mt-0.5 block truncate text-label-sm text-on-surface-variant">
          {distanceMeters !== null && `${formatDistance(distanceMeters)} · `}
          {t(CATEGORY_LABEL[entry.category])}
        </span>
      </span>
      <CongestionBadge level={snapshot?.congestion ?? null} />
    </button>
  )
}
