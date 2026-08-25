import { t } from '../../i18n/t'
import { roadIndexTone, type FacilityLocation } from '../../domain/cityInfo'
import { formatDistance } from '../../domain/distance'
import {
  roadSegmentCenter,
  roadSegmentPath,
  sortRoadSegments,
  type RoadSegment,
} from '../../domain/roadSegment'
import { toneTextClass } from '../common/toneClass'
import { ShowOnMapButton } from './ShowOnMapButton'

/** 한 명소에 281개까지 딸려 오는 데가 있다(여의도). 몇 개만 보여준다. */
const VISIBLE_LIMIT = 5

/**
 * 「세종대로사거리 → 광화문」. 두 끝 중 하나만 와도 그 하나를 적는다.
 *
 * **노드 이름의 4분의 1은 번지꼴이다**(실호출 3,786개 중 978개, 「노량진동
 * 118-14」). 그래도 그대로 적는다 — 나머지 4분의 3이 「수산시장입구교차로」·
 * 「노량진삼거리」처럼 실제로 길을 짚어 주는 이름이고, 번지를 걸러내려면
 * 「이건 사람이 쓰는 이름인가」를 우리가 판정해야 하는데 그럴 근거가 없다.
 */
function stretchLabel(segment: RoadSegment): string {
  const ends = [segment.startName, segment.endName].filter((part) => part !== '')
  return ends.join(' → ')
}

interface Props {
  readonly segments: readonly RoadSegment[]
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 도로 구간별 소통. 시안 `stitch_ui_ux/_4`의 「주요 도로 상황」이다.
 *
 * **시안은 도로 하나에 줄 하나이고 여기는 구간 하나에 줄 하나다.** 시안의
 * 「세종대로 1.2km · 세종대로사거리 → 광화문」처럼 도로를 뭉치려면 그 도로의
 * 구간들이 한 줄로 이어져야 하는데, 2026-08-25 실호출에서 **구간이 둘 이상인
 * 도로 318개 중 이어지는 것은 2개뿐**이었다. 뭉쳐 적으면 떨어져 있는 두 지점을
 * 한 구간처럼 말하게 된다 — 근거는 `cityInfoSchema.ts`의 `toRoadSegments`.
 *
 * 차례는 **지표가 먼저고 속도가 그다음**이다(`sortRoadSegments`). 속도만으로
 * 줄 세우면 안 되는 이유가 그 함수 주석에 있다.
 */
export function RoadSegmentList({ segments, onShowOnMap }: Props) {
  const visible = sortRoadSegments(segments, VISIBLE_LIMIT)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((segment) => {
          const stretch = stretchLabel(segment)
          const path = roadSegmentPath(segment)
          const center = roadSegmentCenter(segment)

          return (
            // `LINK_ID`가 키다. 한 명소 안에서 겹치지 않는 것을 실호출 35곳
            // 1,893건에서 확인했다.
            <li key={segment.linkId} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-baseline gap-1.5">
                  {/* 도로명은 고유명사라 옮기지 않는다. */}
                  <span className="truncate text-body-md text-on-surface">
                    {segment.roadName}
                  </span>
                  {/* 시안의 회색 알약이다. 구간 길이는 실호출에서 11~653m라
                      대부분 「m」로 떨어진다. */}
                  {segment.meters !== null && (
                    <span className="shrink-0 rounded-card bg-surface-container px-1.5 py-0.5 text-label-sm text-on-surface-variant">
                      {formatDistance(segment.meters)}
                    </span>
                  )}
                </p>
                {stretch !== '' && (
                  <p className="mt-0.5 truncate text-label-sm text-on-surface-variant">
                    {stretch}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="text-right">
                  {/* 속도를 못 읽었을 때 0으로 떨어뜨리지 않는다 — 「0km/h」는
                      완전 정체로 읽힌다(`RoadTrafficCard`와 같은 규칙). */}
                  {segment.speed !== null && (
                    <p className={`text-title-md ${toneTextClass(roadIndexTone(segment.index))}`}>
                      {t('{속도}km/h', { 속도: segment.speed })}
                    </p>
                  )}
                  {/* **지표를 속도에서 지어내지 않는다.** 실호출에서 세 지표의
                      속도 범위가 크게 겹쳤다(정체 2~28 · 원활 25~67) — 같은
                      25km/h가 도로에 따라 정체이기도 원활이기도 하다.
                      모르는 값이면 `t()`가 키를 그대로 돌려준다. */}
                  {segment.index !== '' && (
                    <p
                      className={`text-label-sm ${toneTextClass(roadIndexTone(segment.index))}`}
                    >
                      {t(segment.index)}
                    </p>
                  )}
                </div>
                {/* **선으로 그린다.** 다른 「지도에서 보기」는 점 하나를 찍지만
                    도로는 길이가 있는 것이라, 핀만 찍으면 어디서 어디까지
                    막히는지가 빠진다(`XYLIST`가 보간점을 준다). */}
                <ShowOnMapButton
                  place={
                    center === null || path === null
                      ? null
                      : { name: segment.roadName, coords: center, path }
                  }
                  onShow={onShowOnMap}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {segments.length > visible.length && (
        <p className="mt-3 text-label-sm text-outline">
          {t('외 {개수}곳', { 개수: segments.length - visible.length })}
        </p>
      )}
    </>
  )
}
