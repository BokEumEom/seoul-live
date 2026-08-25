import { t } from '../../i18n/t'
import { isDockFull, type BikeStation } from '../../domain/bike'
import { toFacilityLocation, type FacilityLocation } from '../../domain/cityInfo'
import { formatDistance } from '../../domain/distance'
import { sortBikesForWalking } from '../../domain/facilityDistance'
import type { Coords } from '../../domain/types'
import { ShowOnMapButton } from './ShowOnMapButton'
import { ToneBadge } from '../common/ToneBadge'

const VISIBLE_LIMIT = 5

// 자전거는 주차장과 반대 방향이다 — 주차장은 빈 자리가 많아야 좋고 대여소는
// 자전거가 남아 있어야 좋다. 그래서 parkingTone을 재사용하지 않는다.
function stockTone(bikes: number | null): 'calm' | 'normal' | 'crowded' | null {
  if (bikes === null) {
    return null
  }
  if (bikes === 0) {
    return 'crowded'
  }
  return bikes >= 5 ? 'calm' : 'normal'
}

function stockLabel(bikes: number | null): string {
  if (bikes === null) {
    return t('정보 없음')
  }
  return bikes === 0 ? t('대여 불가') : t('{대수}대', { 대수: bikes })
}

interface Props {
  readonly stations: readonly BikeStation[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

export function BikeList({ stations, origin, onShowOnMap }: Props) {
  // **거리순이다(주차장은 대수순).** 걸어가는 곳이라 500m의 20대보다
  // 120m의 5대가 낫다 — 빌릴 수 있는 곳을 먼저 세우고 그 안에서 가까운 순.
  const visible = sortBikesForWalking(stations, origin, VISIBLE_LIMIT)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((station) => (
          // 대여소 ID가 키다. 이름은 서울 쪽에서 바뀔 수 있는 표시용 값이라
          // 바뀌는 순간 React가 같은 줄을 지웠다 새로 만든다.
          <li
            key={station.id || station.name}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="truncate text-body-md text-on-surface">{station.name}</p>
              {/* 샘플(서울 인파레이더)의 「120m · 19대」 자리다. 거리를 앞에
                  두는 이유는 그것이 갈지 말지를 가르는 값이기 때문이다.
                  거치대 수는 그다음이다 — 반납할 자리를 볼 때만 쓴다. */}
              <p className="mt-0.5 text-label-sm text-on-surface-variant">
                {[
                  station.meters === null ? null : formatDistance(station.meters),
                  station.racks === null ? null : t('거치대 {대수}대', { 대수: station.racks }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {/* **자전거를 가지고 온 사람에게는 오른쪽 배지가 반대 신호다** —
                  「7대 가능」은 빌릴 사람의 값이고, 반납하러 온 사람에게 자전거가
                  많다는 것은 꽂을 데가 없다는 뜻이다. 실호출 227곳 중 61곳이
                  이 상태였다(거치율 최대 450%). 찼을 때만 적는다 — 안 찬 곳까지
                  「반납 가능」을 적으면 줄마다 글이 하나씩 늘 뿐이다. */}
              {isDockFull(station) === true && (
                <p className="mt-0.5 text-label-sm text-busy">{t('반납 자리 없음')}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ToneBadge tone={stockTone(station.bikes)} label={stockLabel(station.bikes)} />
              <ShowOnMapButton place={toFacilityLocation(station)} onShow={onShowOnMap} />
            </div>
          </li>
        ))}
      </ul>
      {stations.length > visible.length && (
        <p className="mt-3 text-label-sm text-outline">
          {t('외 {개수}곳', { 개수: stations.length - visible.length })}
        </p>
      )}
    </>
  )
}
