import {
  sortBikesByStock,
  toFacilityLocation,
  type BikeStation,
  type FacilityLocation,
} from '../../domain/cityInfo'
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
  readonly onShowOnMap: (place: FacilityLocation) => void
}

export function BikeList({ stations, onShowOnMap }: Props) {
  const visible = sortBikesByStock(stations, VISIBLE_LIMIT)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((station) => (
          <li key={station.name} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-md text-on-surface">{station.name}</p>
              {station.racks !== null && (
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  거치대 {station.racks}대
                </p>
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
          외 {stations.length - visible.length}곳
        </p>
      )}
    </>
  )
}
