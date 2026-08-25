import { t } from '../../i18n/t'
import {
  parkingAddFee,
  parkingBaseFee,
  parkingTone,
  toFacilityLocation,
  type FacilityLocation,
  type ParkingLot,
} from '../../domain/cityInfo'
import { formatDistance } from '../../domain/distance'
import { ToneBadge } from '../common/ToneBadge'
import { FacilityFact } from './FacilityFact'
import { ShowOnMapButton } from './ShowOnMapButton'

/** 거리까지 잰 주차장 하나. `withDistanceFrom`이 붙여 준다. */
export type ParkingLotWithDistance = ParkingLot & { readonly meters: number | null }

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
    return t('무료')
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
  // 유료인 것은 아는데 요금표가 안 온 곳이 있다. 「유료」만이라도 적는다 —
  // 칸을 비우면 「요금 정보가 없다」와 「공짜다」가 화면에서 같아 보인다.
  return parts.length === 0 ? (lot.paid === true ? t('유료') : '') : parts.join(' · ')
}

/** 「830m · 중구 북창동 35-0」. 둘 중 하나만 와도 그 하나를 적는다. */
function placeLabel(lot: ParkingLotWithDistance): string {
  return [lot.meters === null ? '' : formatDistance(lot.meters), lot.address]
    .filter((part) => part !== '')
    .join(' · ')
}

interface Props {
  readonly lot: ParkingLotWithDistance
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 주차장 한 칸. 시안 `stitch_ui_ux/_5`의 카드다.
 *
 * **줄이 아니라 카드다.** 예전에는 목록의 한 줄이었고 값 다섯을 점으로 이어
 * 붙였다 — 390px에서 두 줄로 접히면 어디까지가 요금인지가 안 보인다. 주차장은
 * 「고르는」 대상이라 한 곳당 볼 것이 넷(자리·요금·거리·주소)이고, 그 넷을
 * 나란히 놓아야 옆 주차장과 견줄 수 있다.
 *
 * **시안의 「42 / 120면」을 배지와 칸으로 갈랐다.** 시안은 잔여와 총 면수를
 * 붙여 적는데, 실호출 818곳 중 **잔여 면수가 오는 곳은 32곳(3.9%)뿐**이다
 * (`CUR_PRK_YN`). 붙여 적는 모양을 그대로 쓰면 96%의 카드에서 앞자리가
 * 빈다 — 그래서 아는 값(총 면수)은 칸에 있고, 실시간으로 오는 값은 배지가
 * 든다. **배지에 낱말이 아니라 숫자를 두는 이유**도 같다: 「42면」은
 * 「여유」보다 강한 말이고, 낱말로 바꾸면 영어 사전의 「여유」(Not crowded,
 * 혼잡도의 뜻)와 겹쳐 뜻이 어긋난다.
 *
 * **시안의 「상세보기」·「내비게이션」은 없다.** 주차장 하나짜리 화면이 이
 * 앱에 없고, 길안내는 명소 단위로 아래 고정된 줄이 맡는다(`MapLinkButtons`) —
 * 카드마다 지도 앱 셋을 늘어놓으면 다섯 곳에 버튼 열다섯 개가 된다.
 * 「지도에서 보기」는 남는다: 앱 안의 지도로 이 점을 비춘다.
 *
 * **「(공영)」·「24시간 운영」은 데이터가 없다.** 운영시간은 `PRK_STTS`에
 * 필드 자체가 없고(명세 45~61행), 구분은 `PRK_TYPE`이 코드로 온다 —
 * 실호출 818곳에서 `BS`(509)·`NS`(167)·`NP`(85)·`NW`(31)·`BP`(26) 다섯 값이
 * 나왔는데 명세가 뜻을 안 준다. 이름으로 미루어 보면 「노상/노외/부설 ×
 * 공영/민영」 같지만, 미루어 본 것을 화면에 「공영」이라고 적을 수는 없다.
 */
export function ParkingCard({ lot, onShowOnMap }: Props) {
  const fee = feeLabel(lot)
  const place = placeLabel(lot)

  return (
    <li className="rounded-card border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex items-start justify-between gap-2">
        {/* 이름은 고유명사라 옮기지 않는다. **제목 태그를 쓰지 않는다** —
            주차장 다섯 곳이 전부 `heading`이 되면 목차를 훑는 사용자에게
            절 제목(「주차장」)과 그 안의 주차장 이름이 같은 층으로 읽힌다.
            지하철 역 이름과 같은 규칙이다(`SubwayArrivals`). */}
        <p className="min-w-0 flex-1 truncate text-body-md font-bold text-on-surface">
          {lot.name}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <ToneBadge
            tone={parkingTone(lot.available, lot.capacity)}
            label={availabilityLabel(lot)}
          />
          <ShowOnMapButton place={toFacilityLocation(lot)} onShow={onShowOnMap} />
        </div>
      </div>

      {/* 두 칸이다. 종류가 다른 값을 같은 구분점으로 잇지 않는다 —
          근거는 `FacilityFact`. */}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {lot.capacity !== null && (
          <FacilityFact icon="parking">
            {t('총 {면수}면', { 면수: lot.capacity.toLocaleString() })}
          </FacilityFact>
        )}
        {fee !== '' && <FacilityFact icon="receipt">{fee}</FacilityFact>}
      </div>

      {/* 거리와 주소는 한 줄이다. 둘 다 「어디인가」의 답이라 서로 붙어 있어야
          하고, 주소가 길어 칸에 넣으면 늘 잘린다. */}
      {place !== '' && (
        <div className="mt-1">
          <FacilityFact icon="pin">
            <span className="block truncate">{place}</span>
          </FacilityFact>
        </div>
      )}
    </li>
  )
}
