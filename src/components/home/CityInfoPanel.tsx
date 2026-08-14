import { useCityInfo } from '../../data/queries'

import { hasAnyCityInfo, type FacilityLocation } from '../../domain/cityInfo'
import { cityInfoSectionDomId } from '../../domain/cityInfoSummary'
import { AccidentList } from '../cityinfo/AccidentList'
import { AlertBanner } from '../cityinfo/AlertBanner'
import { BikeList } from '../cityinfo/BikeList'
import { EventList } from '../cityinfo/EventList'
import { EmptyNote, InfoSection } from '../cityinfo/InfoSection'
import { ParkingList } from '../cityinfo/ParkingList'
import { RoadTrafficCard } from '../cityinfo/RoadTrafficCard'
import { SubwayArrivals } from '../cityinfo/SubwayArrivals'
import { WeatherCard } from '../cityinfo/WeatherCard'
import { ErrorState } from '../common/ErrorState'
import { SkeletonList } from '../common/SkeletonCard'

interface Props {
  readonly areaName: string
  /** 주차장·따릉이 줄의 아이콘이 누르는 것. 지도는 `HomeScreen`이 갖는다. */
  readonly onShowOnMap: (place: FacilityLocation) => void
}

// **예전에는 접이식이었다.** 접힌 동안 areaName을 넘기지 않아 조회가 꺼졌고,
// 그게 하루 1,000회 한도를 지키는 자리였다. 그 대가로 서울 인파레이더가 한
// 화면에 다 펼쳐 주는 것을 우리는 탭 한 번 뒤에 감춰 뒀다.
//
// 한도는 다른 데서 되찾았다. 상세가 목록이 이미 받아 둔 혼잡도를 다시 묻던
// 왕복을 없애 720회/일이 비었고(`queries.ts`의 `findSeededSnapshot`), 도시정보
// 캐시를 3시간으로 늘려 최악을 240회/일로 낮췄다. 합계 960회로 한도 안이다 —
// 계산은 `api/_lib/seoul.ts`의 `cityInfoCacheTtlSeconds` 주석에 있다.
//
// **한 번의 조회가 이 절 전부를 가져온다.** `citydata`는 주차장·따릉이·날씨·
// 문화행사·지하철·재난문자를 한 응답에 담으므로, 안쪽 절을 접어 둬도 호출량은
// 1원도 줄지 않는다. 즉 무엇을 펼치고 접을지는 순전히 화면 문제다.
export function CityInfoPanel({ areaName, onShowOnMap }: Props) {
  const cityInfo = useCityInfo(areaName)
  const info = cityInfo.data

  if (cityInfo.isPending) {
    return (
      <div className="px-4">
        <SkeletonList count={3} />
      </div>
    )
  }

  // 도시 정보가 실패해도 위쪽 혼잡도·예측·길찾기는 그대로 둔다.
  if (cityInfo.isError) {
    return (
      <div className="px-4">
        <ErrorState
          message="도시 정보를 가져오지 못했어요."
          onRetry={() => void cityInfo.refetch()}
        />
      </div>
    )
  }

  if (info === undefined) {
    return null
  }

  if (!hasAnyCityInfo(info)) {
    return (
      <p className="px-4 py-6 text-center text-body-md text-on-surface-variant">
        이 명소에는 지금 제공되는 도시 정보가 없어요.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <AlertBanner alerts={info.alerts} />

      {info.weather !== null && <WeatherCard weather={info.weather} />}

      {/* 도로소통과 사고통제를 한 섹션에 둔다. 같은 주제(지금 이 근처 도로가
          어떤가)이고, 시트가 좁아 관련 정보를 두 섹션으로 나누면 제목만 두 줄
          더 먹는다. 사고가 없으면 목록만 빠진다. */}
      {(info.roadTraffic !== null || info.accidents.length > 0) && (
        <InfoSection title="도로소통" id={cityInfoSectionDomId('road')} icon="road">
          {info.roadTraffic !== null && <RoadTrafficCard traffic={info.roadTraffic} />}
          {info.accidents.length > 0 && (
            <div className={info.roadTraffic === null ? '' : 'mt-3'}>
              <AccidentList accidents={info.accidents} />
            </div>
          )}
        </InfoSection>
      )}

      {/* 도로소통 다음, 따릉이 앞이다 — detail_page.png의 순서다.
          「어떻게 갈까」를 묻는 교통 수단들이 이어서 온다. */}
      {info.subway.length > 0 && (
        <InfoSection
          title="지하철 도착"
          id={cityInfoSectionDomId('subway')}
          icon="subway"
          count={info.subway.length}
          // **「4분 후 도착」은 상대 시각이라 캐시를 견디지 못한다.** 기준을 안
          // 적으면 3시간 전 열차를 지금 오는 것처럼 보여준다. 근본 해법은
          // 응답의 `Age` 헤더를 화면까지 가져와 실제 경과를 적는 것이다.
          note="최대 3시간 전 기준이에요"
        >
          <SubwayArrivals arrivals={info.subway} />
        </InfoSection>
      )}

      <InfoSection
        title="주차장"
        id={cityInfoSectionDomId('parking')}
        icon="parking"
        count={info.parking.length}
        note="잔여 면수는 최대 3시간 전 기준이에요"
      >
        {info.parking.length === 0 ? (
          <EmptyNote>주변에 주차장 정보가 없어요.</EmptyNote>
        ) : (
          <ParkingList lots={info.parking} onShowOnMap={onShowOnMap} />
        )}
      </InfoSection>

      <InfoSection
        title="따릉이"
        id={cityInfoSectionDomId('bikes')}
        icon="bike"
        count={info.bikes.length}
        note="거치 대수는 최대 3시간 전 기준이에요"
      >
        {info.bikes.length === 0 ? (
          <EmptyNote>주변에 따릉이 대여소가 없어요.</EmptyNote>
        ) : (
          <BikeList stations={info.bikes} onShowOnMap={onShowOnMap} />
        )}
      </InfoSection>

      <InfoSection
        title="문화행사"
        id={cityInfoSectionDomId('events')}
        icon="event"
        count={info.events.length}
      >
        {info.events.length === 0 ? (
          <EmptyNote>진행 중인 문화행사가 없어요.</EmptyNote>
        ) : (
          <EventList events={info.events} />
        )}
      </InfoSection>
    </div>
  )
}
