import { t } from '../../../i18n/t'
import type { FacilityLocation } from '../../../domain/cityInfo'
import type { Coords } from '../../../domain/types'
import { BikeList } from '../../cityinfo/BikeList'
import { ChargerList } from '../../cityinfo/ChargerList'
import { freshnessNote } from '../../cityinfo/freshnessNote'
import { EmptyNote, InfoSection } from '../../cityinfo/InfoSection'
import { ParkingList } from '../../cityinfo/ParkingList'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
  /** 주차장·따릉이까지의 거리를 재는 기준점. **명소 중심이지 내 위치가 아니다.** */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 주변 탭 — 주차장 · 따릉이.
 *
 * 시안(stitch_ui_ux/_5)은 주차장에 화면 하나를 통째로 쓰지만 우리는 한 탭에
 * 묶었다 — 「차를 어디 대나 / 자전거가 있나 / 충전할 데가 있나」가 전부
 * **여기 도착해서 무엇을 하나**라는 같은 질문의 답이다.
 *
 * 주차 요금은 2026-08-25에 붙었다(그전 주석은 「값이 모자란다」였는데, 실호출을
 * 재 보니 `RATES`·`TIME_RATES`가 오고 있었다). 전기차 충전도 같은 회차다.
 */
export function NearbyPanel({ areaName, origin, onShowOnMap }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) =>
        info.parking.length > 0 || info.bikes.length > 0 || info.chargers.length > 0
      }
      empty={t('주변 주차장·따릉이 정보가 없어요.')}
    >
      {(info) => (
        <div className="flex flex-col gap-3">
          <InfoSection
            title={t('주차장')}
            icon="parking"
            count={info.parking.length}
            note={freshnessNote(
              info.freshness,
              t('잔여 면수는 최대 3시간 전 기준이에요'),
            )}
          >
            {info.parking.length === 0 ? (
              <EmptyNote>{t('주변에 주차장 정보가 없어요.')}</EmptyNote>
            ) : (
              <ParkingList
                lots={info.parking}
                origin={origin}
                onShowOnMap={onShowOnMap}
              />
            )}
          </InfoSection>

          <InfoSection
            title={t('따릉이')}
            icon="bike"
            count={info.bikes.length}
            note={freshnessNote(
              info.freshness,
              t('거치 대수는 최대 3시간 전 기준이에요'),
            )}
          >
            {info.bikes.length === 0 ? (
              <EmptyNote>{t('주변에 따릉이 대여소가 없어요.')}</EmptyNote>
            ) : (
              <BikeList
                stations={info.bikes}
                origin={origin}
                onShowOnMap={onShowOnMap}
              />
            )}
          </InfoSection>

          {/* **충전소는 절이 통째로 빠진다.** 주차장·따릉이와 다른 이유가 있다 —
              저 둘은 「없다」는 사실 자체가 답이지만(차를 어디 대나 / 자전거가
              있나), 충전소는 전기차를 모는 사람만 묻는다. 없는 곳에 빈 절을
              세우면 나머지 사용자에게는 잡음이다. 실호출에서 여의도한강공원이
              0곳이었고 명소별 편차가 0~44곳으로 크다. */}
          {info.chargers.length > 0 && (
            <InfoSection
              title={t('전기차 충전')}
              icon="charger"
              count={info.chargers.length}
              note={freshnessNote(
                info.freshness,
                t('충전기 상태는 최대 3시간 전 기준이에요'),
              )}
            >
              <ChargerList
                stations={info.chargers}
                origin={origin}
                onShowOnMap={onShowOnMap}
              />
            </InfoSection>
          )}
        </div>
      )}
    </CityInfoBoundary>
  )
}
