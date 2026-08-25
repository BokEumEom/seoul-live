import { t } from '../../../i18n/t'
import { isBusCallFailure, type FacilityLocation } from '../../../domain/cityInfo'
import type { Coords } from '../../../domain/types'
import { AccidentList } from '../../cityinfo/AccidentList'
import { BusStopList } from '../../cityinfo/BusStopList'
import { freshnessNote } from '../../cityinfo/freshnessNote'
import { InfoSection } from '../../cityinfo/InfoSection'
import { RidershipSummary } from '../../cityinfo/RidershipSummary'
import { RoadTrafficCard } from '../../cityinfo/RoadTrafficCard'
import { SubwayArrivals } from '../../cityinfo/SubwayArrivals'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
  /** 정류소까지의 거리를 재는 기준점. **명소 중심이지 내 위치가 아니다.** */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 교통 탭 — 도로소통 · 차량 통제 · 지하철.
 *
 * 시안(stitch_ui_ux/_4)의 차례다. **차량 통제가 도로소통 바로 아래인 것은
 * 같은 질문의 답이기 때문**이다 — 「지금 차로 갈 만한가」에 평균 속도와 통제
 * 여부가 함께 답한다. 예전 `CityInfoPanel`도 둘을 한 절에 뒀는데, 그때는
 * 시트가 좁아 제목 줄을 아끼려던 것이고 지금은 화면이 통째로 이 주제다.
 */
export function TrafficPanel({ areaName, origin, onShowOnMap }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) =>
        info.roadTraffic !== null ||
        info.accidents.length > 0 ||
        info.subway.length > 0 ||
        // 승하차와 정류소도 이 탭의 내용이다. 안 세면 도착 정보가 없는 명소에서
        // 「교통 정보가 없어요」를 띄우면서 그 아래로 승하차 절을 그리게 된다.
        info.subwayRidership !== null ||
        info.busStops.length > 0 ||
        info.busRidership !== null
      }
      empty={t('이 명소에는 지금 제공되는 교통 정보가 없어요.')}
    >
      {(info) => (
        <div className="flex flex-col gap-3">
          {(info.roadTraffic !== null || info.accidents.length > 0) && (
            <InfoSection title={t('도로소통')} icon="road">
              {info.roadTraffic !== null && (
                <RoadTrafficCard traffic={info.roadTraffic} />
              )}
              {info.accidents.length > 0 && (
                <div className={info.roadTraffic === null ? '' : 'mt-3'}>
                  <AccidentList accidents={info.accidents} />
                </div>
              )}
            </InfoSection>
          )}

          {(info.subway.length > 0 || info.subwayRidership !== null) && (
            <InfoSection
              title={t('지하철 도착')}
              icon="subway"
              count={info.subway.length}
              // **「4분 후 도착」은 상대 시각이라 캐시를 견디지 못한다.** 기준을
              // 안 적으면 3시간 전 열차를 지금 오는 것처럼 보여준다.
              note={freshnessNote(info.freshness, t('최대 3시간 전 기준이에요'))}
            >
              {/* 승하차가 도착보다 위다. 「지금 사람이 모이는 중인가」가 이 절의
                  머리이고, 어느 열차가 몇 분 뒤인지는 그다음 질문이다. */}
              {info.subwayRidership !== null && (
                <div className={info.subway.length > 0 ? 'mb-3' : ''}>
                  <RidershipSummary ridership={info.subwayRidership} />
                </div>
              )}
              {info.subway.length > 0 && <SubwayArrivals arrivals={info.subway} />}
            </InfoSection>
          )}

          {(info.busStops.length > 0 || info.busRidership !== null) && (
            <InfoSection
              title={t('버스 정류소')}
              icon="bus"
              count={info.busStops.length}
            >
              {info.busRidership !== null && (
                <div className={info.busStops.length > 0 ? 'mb-3' : ''}>
                  <RidershipSummary ridership={info.busRidership} />
                </div>
              )}
              {info.busStops.length > 0 && (
                <BusStopList
                  stops={info.busStops}
                  origin={origin}
                  onShowOnMap={onShowOnMap}
                />
              )}
              {/* **목록이 비었을 때만 호출 메시지를 적는다.** 「이 근처에 정류소가
                  없다」와 「버스 쪽 호출이 실패했다」는 다른 안내인데 빈 목록만
                  보면 구분이 안 된다. 자유 문장이라 원문 그대로 나간다. */}
              {info.busStops.length === 0 && isBusCallFailure(info.busResultMessage) && (
                <p className="text-label-sm text-outline">{info.busResultMessage}</p>
              )}
            </InfoSection>
          )}
        </div>
      )}
    </CityInfoBoundary>
  )
}
