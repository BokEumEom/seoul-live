import { t } from '../../i18n/t'
import {
  availableChargerCount,
  chargerStationTone,
  chargerTypeParts,
  isFastCharger,
  sortChargerStations,
  type ChargerStation,
} from '../../domain/charger'
import { formatDistance } from '../../domain/distance'
import { withDistanceFrom } from '../../domain/facilityDistance'
import type { Coords } from '../../domain/types'
import type { FacilityLocation } from '../../domain/cityInfo'
import { ShowOnMapButton } from './ShowOnMapButton'
import { ToneBadge } from '../common/ToneBadge'

/** 한 명소에 마흔 곳 넘게 딸려 오는 데가 있다(광화문 44곳). 몇 곳만 보여준다. */
const VISIBLE_LIMIT = 5

/**
 * 「급속 100kW」·「완속 7kW」. 충전기마다 다를 수 있어 **가장 빠른 것 하나**를
 * 대표로 적는다 — 목록에서 알고 싶은 것은 「여기 급속이 있나」이지 대별 명세가
 * 아니다.
 */
function speedLabel(station: ChargerStation): string | null {
  const usable = station.chargers.filter((charger) => charger.outputKw !== null)
  if (usable.length === 0) {
    return null
  }
  const fastest = usable.reduce((best, charger) =>
    (charger.outputKw ?? 0) > (best.outputKw ?? 0) ? charger : best,
  )
  const speed = isFastCharger(fastest) ? t('급속') : t('완속')
  return t('{종류} {출력}kW', { 종류: speed, 출력: fastest.outputKw ?? 0 })
}

/** 충전 방식. 복합값은 조각마다 감싼다 — 조합마다 사전 항목을 만들지 않는다. */
function typeLabel(station: ChargerStation): string | null {
  const types = [...new Set(station.chargers.flatMap((charger) => chargerTypeParts(charger.type)))]
  return types.length === 0 ? null : types.map((part) => t(part)).join(' · ')
}

interface Props {
  readonly stations: readonly ChargerStation[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 전기차충전소 목록. `CHARGER_STTS`를 그린다.
 *
 * **차례는 「들어갈 수 있나」가 먼저다**(`sortChargerStations`). 실호출에서
 * 27%가 이용 제한이 걸려 있었고, 사용가능 대수만으로 줄 세우면 못 들어가는
 * 충전소가 맨 위에 온다 — 거기까지 가서야 알게 되는 것이 이 목록의 최악이다.
 */
export function ChargerList({ stations, origin, onShowOnMap }: Props) {
  const visible = withDistanceFrom(sortChargerStations(stations, VISIBLE_LIMIT), origin)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((station) => {
          const available = availableChargerCount(station)
          const speed = speedLabel(station)
          const types = typeLabel(station)

          return (
            // 충전소 ID가 키다. 같은 이름의 충전소가 여럿 온다(「○○아파트」).
            <li key={station.id || station.name} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* 이름은 고유명사라 옮기지 않는다. */}
                <p className="truncate text-body-md text-on-surface">{station.name}</p>
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  {station.meters !== null && `${formatDistance(station.meters)} · `}
                  {station.kind !== '' && `${t(station.kind)} · `}
                  {speed ?? types ?? t('정보 없음')}
                </p>
                {/* **제한 사유는 서울 API의 자유 문장이라 옮기지 않는다.**
                    서른일곱 가지가 나왔고 「거주자외 출입제한」처럼 표현이 제각각이다.
                    그래도 원문이 있는 편이 「제한 있음」 한 마디보다 쓸모 있다. */}
                {station.limited === true && (
                  <p className="mt-0.5 text-label-sm text-busy">
                    {station.limitDetail === '' ? t('이용 제한 있음') : station.limitDetail}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ToneBadge
                  tone={chargerStationTone(station)}
                  // 「0대」가 아니라 「사용 불가」다 — 0은 「충전기가 없다」로도
                  // 읽히는데, 여기 있는 충전소는 전부 충전기가 있다.
                  label={
                    available === 0
                      ? t('사용 불가')
                      : t('{대수}대 가능', { 대수: available })
                  }
                />
                <ShowOnMapButton
                  place={
                    station.coords === null ? null : { name: station.name, coords: station.coords }
                  }
                  onShow={onShowOnMap}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {stations.length > visible.length && (
        <p className="mt-3 text-label-sm text-outline">
          {t('외 {개수}곳', { 개수: stations.length - visible.length })}
        </p>
      )}
    </>
  )
}
