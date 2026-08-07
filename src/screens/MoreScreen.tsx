import { useState } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AlertBanner } from '../components/cityinfo/AlertBanner'
import { AreaPicker } from '../components/more/AreaPicker'
import { BikeList } from '../components/cityinfo/BikeList'
import { EmptyNote, InfoSection } from '../components/cityinfo/InfoSection'
import { EventList } from '../components/cityinfo/EventList'
import { ParkingList } from '../components/cityinfo/ParkingList'
import { WeatherCard } from '../components/cityinfo/WeatherCard'
import { AREA_CATALOG } from '../data/areas'
import { useCityInfo } from '../data/queries'
import { hasAnyCityInfo } from '../domain/cityInfo'
import { nearestEntry } from '../domain/distance'

// 위치를 모를 때의 기본 명소. 서울의 한가운데이자 서울 API가 `sample` 키로도
// 돌려주는 곳이라, 인증키 전환 뒤 첫 확인에도 이 명소를 쓰게 된다.
const DEFAULT_AREA_NAME = '광화문·덕수궁'

export function MoreScreen() {
  const location = useLocation()
  // 사용자가 고른 값이 항상 위치보다 우선한다. 위치는 늦게 도착하는데, 그때
  // 선택을 덮어쓰면 스크롤하던 화면이 다른 명소로 통째로 바뀐다.
  const [picked, setPicked] = useState<string | null>(null)
  const areaName =
    picked ?? nearestEntry(AREA_CATALOG, location.coords)?.name ?? DEFAULT_AREA_NAME

  const query = useCityInfo(areaName)
  const info = query.data

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="px-4 pt-4">
        <h2 className="text-headline-md text-on-surface">도시 정보</h2>
        <p className="mt-1 text-label-md text-on-surface-variant">
          주차장 · 따릉이 · 날씨 · 문화행사를 한 번에
        </p>
      </section>

      {/* 실패해도 선택은 남긴다. 같이 감추면 다른 명소로 갈아타 볼 수도 없이 막힌다. */}
      <AreaPicker value={areaName} onChange={setPicked} />

      {query.isPending && (
        <div className="px-4">
          <SkeletonList count={4} />
        </div>
      )}

      {query.isError && (
        <div className="px-4">
          <ErrorState
            message="도시 정보를 가져오지 못했어요."
            onRetry={() => void query.refetch()}
          />
        </div>
      )}

      {info !== undefined &&
        (hasAnyCityInfo(info) ? (
          <>
            <AlertBanner alerts={info.alerts} />

            {info.weather !== null && <WeatherCard weather={info.weather} />}

            <InfoSection title="주차장">
              {info.parking.length === 0 ? (
                <EmptyNote>주변에 주차장 정보가 없어요.</EmptyNote>
              ) : (
                <ParkingList lots={info.parking} />
              )}
            </InfoSection>

            <InfoSection title="따릉이">
              {info.bikes.length === 0 ? (
                <EmptyNote>주변에 따릉이 대여소가 없어요.</EmptyNote>
              ) : (
                <BikeList stations={info.bikes} />
              )}
            </InfoSection>

            <InfoSection title="문화행사">
              {info.events.length === 0 ? (
                <EmptyNote>진행 중인 문화행사가 없어요.</EmptyNote>
              ) : (
                <EventList events={info.events} />
              )}
            </InfoSection>
          </>
        ) : (
          <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
            이 명소에는 지금 제공되는 도시 정보가 없어요.
          </p>
        ))}
    </div>
  )
}
