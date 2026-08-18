import {
  toFacilityLocation,
  type BikeStation,
  type FacilityLocation,
} from '../../domain/cityInfo'
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
    return '정보 없음'
  }
  return bikes === 0 ? '대여 불가' : `${bikes}대`
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
          <li key={station.name} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-md text-on-surface">{station.name}</p>
              {/* 샘플(서울 인파레이더)의 「120m · 19대」 자리다. 거리를 앞에
                  두는 이유는 그것이 갈지 말지를 가르는 값이기 때문이다.
                  거치대 수는 그다음이다 — 반납할 자리를 볼 때만 쓴다. */}
              <p className="mt-0.5 text-label-sm text-on-surface-variant">
                {[
                  station.meters === null ? null : formatDistance(station.meters),
                  station.racks === null ? null : `거치대 ${String(station.racks)}대`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
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
          외 {stations.length - visible.length}곳
        </p>
      )}
    </>
  )
}
