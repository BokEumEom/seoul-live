import { t } from '../../i18n/t'
import { sortParkingByAvailable, type ParkingLot } from '../../domain/cityInfo'
import type { FacilityLocation } from '../../domain/cityInfo'
import { withDistanceFrom } from '../../domain/facilityDistance'
import type { Coords } from '../../domain/types'
import { ParkingCard } from './ParkingCard'

/** 한 명소에 주차장이 수십 곳 딸려 오는 경우가 있다. 여유 많은 순으로 몇 곳만 보여준다. */
const VISIBLE_LIMIT = 5

interface Props {
  readonly lots: readonly ParkingLot[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 주차장 목록. 한 칸의 생김새는 `ParkingCard`가 갖는다.
 *
 * **차례는 대수순 그대로다(따릉이는 거리순).** 시안 `stitch_ui_ux/_5`는
 * 「거리순」 칩을 달아 정렬을 고르게 하는데, 여기는 고르는 자리를 안 만들었다 —
 * 차로 가는 곳이라 200m 더 가까운 것보다 빈 자리가 있는 쪽이 낫고, 만차면
 * 거리가 무의미하다. 정렬 손잡이는 「무엇이 나은가」를 사용자에게 미루는
 * 장치인데 여기서는 답이 하나다.
 */
export function ParkingList({ lots, origin, onShowOnMap }: Props) {
  const visible = withDistanceFrom(sortParkingByAvailable(lots, VISIBLE_LIMIT), origin)

  return (
    <>
      <ul className="flex flex-col gap-2">
        {visible.map((lot) => (
          // **코드가 키다.** 이름으로 잡으면 「세종대로1·2·3 관광버스 승하차
          // 허용 구간」처럼 잘려서 같아 보이는 이름들이 부딪힌다. 코드가 없는
          // 응답에서는 이름으로 돌아간다.
          <ParkingCard key={lot.code || lot.name} lot={lot} onShowOnMap={onShowOnMap} />
        ))}
      </ul>
      {lots.length > visible.length && (
        <p className="mt-3 text-label-sm text-outline">
          {t('외 {개수}곳', { 개수: lots.length - visible.length })}
        </p>
      )}
    </>
  )
}
