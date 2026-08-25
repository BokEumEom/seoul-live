import { t } from '../../i18n/t'
import {
  parkingAddFee,
  parkingBaseFee,
  parkingTone,
  sortParkingByAvailable,
  type ParkingLot,
} from '../../domain/cityInfo'
import { toFacilityLocation, type FacilityLocation } from '../../domain/cityInfo'
import { formatDistance } from '../../domain/distance'
import { withDistanceFrom } from '../../domain/facilityDistance'
import type { Coords } from '../../domain/types'
import { ShowOnMapButton } from './ShowOnMapButton'
import { ToneBadge } from '../common/ToneBadge'

/** 한 명소에 주차장이 수십 곳 딸려 오는 경우가 있다. 여유 많은 순으로 몇 곳만 보여준다. */
const VISIBLE_LIMIT = 5

// "정보 없음"과 "만차"를 같은 문구로 묶으면, 실시간 정보를 주지 않는 주차장이
// 전부 만차로 보인다 — 그 앞을 지나가는 사용자에게는 정반대의 안내다.
function availabilityLabel(lot: ParkingLot): string {
  if (lot.available === null) {
    return lot.liveAvailable ? t('정보 없음') : t('실시간 미제공')
  }
  return lot.available === 0
    ? t('만차')
    : t('{면수}면', { 면수: lot.available.toLocaleString() })
}

/**
 * 요금 한 조각. 시안 `stitch_ui_ux/_5`의 「10분당 800원」 자리다.
 *
 * **「무료」와 겹칠 때는 요금을 안 적는다.** `PAY_YN: 'N'`인 주차장은 요금 네
 * 값이 전부 0으로 오는데(실호출의 관광버스 승하차 구간 셋), 그때 「0분 0원」을
 * 적으면 잡음이다 — 「무료」 한 낱말이 이미 다 말했다.
 *
 * **기본요금 0원은 무료가 아니다.** 유료 주차장인데 `RATES: '0'`인 곳이 실제로
 * 있고, 그건 「기본 시간 동안 무료」다(`parkingBaseFee`).
 */
function feeLabel(lot: ParkingLot): string {
  if (lot.paid === false) {
    return ''
  }
  const base = parkingBaseFee(lot.fee)
  const add = parkingAddFee(lot.fee)
  const parts: string[] = []

  if (base !== null) {
    parts.push(
      base.kind === 'freeFor'
        ? t('{분}분 무료', { 분: base.minutes })
        : t('{분}분 {요금}원', { 분: base.minutes, 요금: base.won.toLocaleString() }),
    )
  }
  if (add !== null) {
    parts.push(t('이후 {분}분당 {요금}원', { 분: add.minutes, 요금: add.won.toLocaleString() }))
  }
  return parts.join(' · ')
}

// 거리를 맨 앞에 둔다 — 어느 주차장으로 갈지 고를 때 먼저 보는 값이다.
// 총 면수·유무료·요금은 그 뒤다.
function describe(lot: ParkingLot & { readonly meters: number | null }): string {
  const parts: string[] = []
  if (lot.meters !== null) {
    parts.push(formatDistance(lot.meters))
  }
  if (lot.capacity !== null) {
    parts.push(t('총 {면수}면', { 면수: lot.capacity.toLocaleString() }))
  }
  if (lot.paid !== null) {
    parts.push(lot.paid ? t('유료') : t('무료'))
  }
  const fee = feeLabel(lot)
  if (fee !== '') {
    parts.push(fee)
  }
  return parts.join(' · ')
}

interface Props {
  readonly lots: readonly ParkingLot[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

export function ParkingList({ lots, origin, onShowOnMap }: Props) {
  // **정렬은 대수순 그대로다(따릉이는 거리순).** 차로 가는 곳이라 200m 더
  // 가까운 것보다 빈 자리가 있는 쪽이 낫다 — 만차면 거리가 무의미하다.
  const visible = withDistanceFrom(sortParkingByAvailable(lots, VISIBLE_LIMIT), origin)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((lot) => (
          // **코드가 키다.** 이름으로 잡으면 「세종대로1·2·3 관광버스 승하차
          // 허용 구간」처럼 잘려서 같아 보이는 이름들이 부딪힌다. 코드가 없는
          // 응답에서는 이름으로 돌아간다.
          <li key={lot.code || lot.name} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-md text-on-surface">{lot.name}</p>
              {describe(lot) !== '' && (
                <p className="mt-0.5 text-label-sm text-on-surface-variant">{describe(lot)}</p>
              )}
              {/* 주소는 고유명사라 옮기지 않는다. 거리만으로는 「어느 쪽인가」가
                  안 나와서, 실제로 차를 몰고 가는 사람에게 필요한 줄이다. */}
              {lot.address !== '' && (
                <p className="mt-0.5 truncate text-label-sm text-outline">{lot.address}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ToneBadge
                tone={parkingTone(lot.available, lot.capacity)}
                label={availabilityLabel(lot)}
              />
              <ShowOnMapButton place={toFacilityLocation(lot)} onShow={onShowOnMap} />
            </div>
          </li>
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
