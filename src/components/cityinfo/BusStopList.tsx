import { t } from '../../i18n/t'
import type { BusStop } from '../../domain/cityInfo'
import { formatDistance } from '../../domain/distance'
import { withDistanceFrom } from '../../domain/facilityDistance'
import type { Coords } from '../../domain/types'
import type { FacilityLocation } from '../../domain/cityInfo'
import { ShowOnMapButton } from './ShowOnMapButton'

/** 한 명소에 정류소가 쉰 곳 넘게 딸려 오는 곳이 있다(홍대 52곳). 가까운 순 다섯. */
const VISIBLE_LIMIT = 5

interface Props {
  readonly stops: readonly BusStop[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 버스정류소 목록. `BUS_STN_STTS`를 그린다.
 *
 * **도착 정보는 없다.** 이 API가 주는 것은 이름·좌표·번호뿐이고, 시안
 * `stitch_ui_ux/_4`의 「401 곧 도착」에 해당하는 데이터가 응답에 아예 없다.
 * 지어내지 않고 정류소까지만 그린다.
 *
 * **거리순이다**(주차장은 여유순). 정류소는 골라 갈 대상이 아니라 「어디서
 * 타나」의 답이라, 가까운 것이 먼저다 — 따릉이와 같은 이유다.
 */
export function BusStopList({ stops, origin, onShowOnMap }: Props) {
  const visible = withDistanceFrom(stops, origin).slice(0, VISIBLE_LIMIT)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((stop) => (
          // 내부 ID가 키다. 정류소 이름은 「광화문역」처럼 같은 것이 여럿이다.
          <li key={stop.id || stop.arsId} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {/* 이름은 고유명사라 옮기지 않는다. */}
              <p className="truncate text-body-md text-on-surface">{stop.name}</p>
              <p className="mt-0.5 text-label-sm text-on-surface-variant">
                {/* **번호가 이름보다 실물이다** — 정류소 기둥에 붙어 있고 버스
                    앱에서 검색하는 것도 이 번호다. 거리보다 앞에 둔다. */}
                {stop.arsId !== '' && t('{번호}번', { 번호: stop.arsId })}
                {stop.arsId !== '' && stop.meters !== null && ' · '}
                {stop.meters !== null && formatDistance(stop.meters)}
              </p>
            </div>
            <ShowOnMapButton
              place={stop.coords === null ? null : { name: stop.name, coords: stop.coords }}
              onShow={onShowOnMap}
            />
          </li>
        ))}
      </ul>
      {stops.length > visible.length && (
        <p className="mt-3 text-label-sm text-outline">
          {t('외 {개수}곳', { 개수: stops.length - visible.length })}
        </p>
      )}
    </>
  )
}
