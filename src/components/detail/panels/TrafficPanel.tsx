import { t } from '../../../i18n/t'
import { AccidentList } from '../../cityinfo/AccidentList'
import { freshnessNote } from '../../cityinfo/freshnessNote'
import { InfoSection } from '../../cityinfo/InfoSection'
import { RoadTrafficCard } from '../../cityinfo/RoadTrafficCard'
import { SubwayArrivals } from '../../cityinfo/SubwayArrivals'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
}

/**
 * 교통 탭 — 도로소통 · 차량 통제 · 지하철.
 *
 * 시안(stitch_ui_ux/_4)의 차례다. **차량 통제가 도로소통 바로 아래인 것은
 * 같은 질문의 답이기 때문**이다 — 「지금 차로 갈 만한가」에 평균 속도와 통제
 * 여부가 함께 답한다. 예전 `CityInfoPanel`도 둘을 한 절에 뒀는데, 그때는
 * 시트가 좁아 제목 줄을 아끼려던 것이고 지금은 화면이 통째로 이 주제다.
 */
export function TrafficPanel({ areaName }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) =>
        info.roadTraffic !== null || info.accidents.length > 0 || info.subway.length > 0
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

          {info.subway.length > 0 && (
            <InfoSection
              title={t('지하철 도착')}
              icon="subway"
              count={info.subway.length}
              // **「4분 후 도착」은 상대 시각이라 캐시를 견디지 못한다.** 기준을
              // 안 적으면 3시간 전 열차를 지금 오는 것처럼 보여준다.
              note={freshnessNote(info.freshness, t('최대 3시간 전 기준이에요'))}
            >
              <SubwayArrivals arrivals={info.subway} />
            </InfoSection>
          )}
        </div>
      )}
    </CityInfoBoundary>
  )
}
