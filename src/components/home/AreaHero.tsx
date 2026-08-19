import type { ReactNode } from 'react'
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
  /**
   * 제목 줄 오른쪽에 설 조작부. 지금은 즐겨찾기·인스타그램·공유
   * (`ActionButtons`)다.
   *
   * **슬롯인 이유는 조회 경계다.** 저장·공유는 즐겨찾기 저장소와 공유 브리지를
   * 알아야 하는데, 히어로는 카탈로그 한 줄만 보고 그리는 순수한 조각이다.
   * 여기서 직접 부르면 그 둘이 히어로를 다시 그리게 된다.
   */
  readonly actions?: ReactNode
}

// Google Maps 장소 카드의 히어로 순서다 — 이름, 카테고리·거리·도보 시간,
// 그리고 오른쪽에 조작부와 상태 배지.
//
// **조작부가 제목과 같은 줄이다.** 샘플(서울 인파레이더)의 배치다 — 별·
// 인스타·공유가 이름 옆에 아이콘으로 붙고 그 오른쪽 끝에 혼잡도 배지가 온다.
// 이 줄에 넣지 않으면 아래에 48px짜리 행이 하나 더 생긴다(근거는
// `ActionButtons`의 주석).
export function AreaHero({ entry, coords, level, actions }: Props) {
  // 도보 시간은 domain/distance가 유일한 출처다. 여기서 다시 환산하면
  // RecommendationCard와 조용히 갈리고, 상한도 자리마다 달라진다.
  const distanceMeters = coords === null ? null : haversineMeters(coords, entry)
  const walkMinutes = distanceMeters === null ? null : walkableMinutes(distanceMeters)

  return (
    // `items-center`다. 아이콘 버튼이 48px이고 제목 첫 줄은 그 절반쯤이라
    // `items-start`로 두면 아이콘이 제목보다 한참 아래에 걸린다. 이름이 두 줄인
    // 명소(영어 화면의 대부분)에서는 조작부가 두 줄의 한가운데에 선다.
    <div className="flex items-center justify-between gap-2 px-4">
      <div className="min-w-0 flex-1">
        {/* `truncate`가 아니라 `line-clamp-2`다. 한 줄로 자르면 **영어 이름이
            잘린다** — 영어는 「Hongik Univ. Station (…」로 끊겨 어느 역인지 못
            읽었다. 두 줄까지인 것은 이름이 카드 하나를 통째로 먹지 않게 하려는
            것이다.

            **`break-words`가 없으면 line-clamp가 소리 없이 글자를 잘라먹는다.**
            조작부가 이 줄로 올라오면서 제목에 남는 폭이 약 130px이 됐는데
            (390×844 실측), 「Gyeongbokgung」은 한 낱말이라 그 폭에서 줄을 바꿀
            자리가 없다 — 넘친 부분이 `overflow: hidden`에 걸려 **말줄임표도
            없이** 「Gyeongbokgu」에서 뚝 끊겼다. 낱말 중간에서라도 줄을 바꾸는
            편이 낫다. 한국어는 글자마다 바꿀 수 있어 달라지는 것이 없다. */}
        <h2 className="line-clamp-2 break-words text-headline-md text-on-surface">
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
      {/* 배지가 조작부보다 **오른쪽**이다. 샘플의 순서이기도 하지만 이유가
          따로 있다 — 배지는 혼잡도 응답이 와야 생기는데, 왼쪽에 두면 도착하는
          순간 아이콘 셋이 통째로 밀린다. 오른쪽 끝에서 자라면 밀리는 것이
          없다. */}
      {actions}
      {level !== undefined && <CongestionBadge level={level} />}
    </div>
  )
}
