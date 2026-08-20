import { t } from '../../../i18n/t'
import type { FacilityLocation } from '../../../domain/cityInfo'
import type { Coords } from '../../../domain/types'
import { BikeList } from '../../cityinfo/BikeList'
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
 * 시안(stitch_ui_ux/_5)은 주차장에 화면 하나를 통째로 쓰지만, 우리 응답에는
 * 요금·운영시간이 아직 안 들어와 있어(`seoul_realdata.md`의 미구현 필드) 그
 * 화면을 채울 값이 모자란다. 대신 「걸어서 닿는 것」 둘을 한 탭에 묶었다 —
 * 둘 다 「차를 어디 대나 / 자전거가 있나」라는 같은 질문의 답이다.
 */
export function NearbyPanel({ areaName, origin, onShowOnMap }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) => info.parking.length > 0 || info.bikes.length > 0}
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
        </div>
      )}
    </CityInfoBoundary>
  )
}
