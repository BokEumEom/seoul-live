import { useState } from 'react'
import { useCityInfo } from '../../data/queries'
import { hasAnyCityInfo } from '../../domain/cityInfo'
import { AccidentList } from '../cityinfo/AccidentList'
import { AlertBanner } from '../cityinfo/AlertBanner'
import { BikeList } from '../cityinfo/BikeList'
import { EventList } from '../cityinfo/EventList'
import { EmptyNote, InfoSection } from '../cityinfo/InfoSection'
import { ParkingList } from '../cityinfo/ParkingList'
import { RoadTrafficCard } from '../cityinfo/RoadTrafficCard'
import { WeatherCard } from '../cityinfo/WeatherCard'
import { ErrorState } from '../common/ErrorState'
import { Icon } from '../common/Icon'
import { SkeletonList } from '../common/SkeletonCard'

interface Props {
  readonly areaName: string
}

// 접이식 도시 정보. 접힌 동안은 areaName을 넘기지 않아 useCityInfo의 enabled가
// false가 된다 — 하루 1,000회 제한을 혼잡도와 나눠 쓰므로 상세를 열 때마다
// 부르면 안 된다. 여는 상태와 조회를 한 파일에 둔 이유가 이것이다.
export function CityInfoPanel({ areaName }: Props) {
  const [open, setOpen] = useState(false)
  const cityInfo = useCityInfo(open ? areaName : undefined)
  const info = cityInfo.data

  return (
    <section className="mx-4 rounded-card border border-outline-variant">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between px-4 text-label-md font-semibold text-on-surface"
      >
        이곳의 도시 정보
        <Icon name={open ? 'chevronUp' : 'chevronDown'} className="size-4" />
      </button>

      {open && (
        <div className="flex flex-col gap-3 pb-4">
          {cityInfo.isPending && (
            <div className="px-4">
              <SkeletonList count={3} />
            </div>
          )}

          {/* 도시 정보가 실패해도 위쪽 혼잡도·예측·길찾기는 그대로 둔다. */}
          {cityInfo.isError && (
            <div className="px-4">
              <ErrorState
                message="도시 정보를 가져오지 못했어요."
                onRetry={() => void cityInfo.refetch()}
              />
            </div>
          )}

          {info !== undefined &&
            (hasAnyCityInfo(info) ? (
              <>
                <AlertBanner alerts={info.alerts} />

                {info.weather !== null && <WeatherCard weather={info.weather} />}

                {/* 도로소통과 사고통제를 한 섹션에 둔다. 같은 주제(지금 이 근처
                    도로가 어떤가)이고, 시트가 좁아 관련 정보를 두 섹션으로
                    나누면 제목만 두 줄 더 먹는다. 사고가 없으면 목록만 빠진다. */}
                {(info.roadTraffic !== null || info.accidents.length > 0) && (
                  <InfoSection title="도로소통">
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
              <p className="px-4 py-6 text-center text-body-md text-on-surface-variant">
                이 명소에는 지금 제공되는 도시 정보가 없어요.
              </p>
            ))}
        </div>
      )}
    </section>
  )
}
