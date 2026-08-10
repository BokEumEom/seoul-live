import { useState } from 'react'
import { useLocation } from '../../app/locationContext'
import { AlertBanner } from '../cityinfo/AlertBanner'
import { BikeList } from '../cityinfo/BikeList'
import { EventList } from '../cityinfo/EventList'
import { EmptyNote, InfoSection } from '../cityinfo/InfoSection'
import { ParkingList } from '../cityinfo/ParkingList'
import { WeatherCard } from '../cityinfo/WeatherCard'
import { CongestionBadge } from '../common/CongestionBadge'
import { ErrorState } from '../common/ErrorState'
import { Icon } from '../common/Icon'
import { SkeletonList } from '../common/SkeletonCard'
import { ActionButtons } from '../forecast/ActionButtons'
import { ForecastChart } from '../forecast/ForecastChart'
import { AreaList } from '../list/AreaList'
import { AreaListItem } from '../list/AreaListItem'
import { AREA_NAMES, findAreaByName } from '../../data/areas'
import { useAreaSnapshot, useAreaSnapshots, useCityInfo } from '../../data/queries'
import { hasAnyCityInfo } from '../../domain/cityInfo'
import { congestionHeadline } from '../../domain/congestion'
import { findQuietTime } from '../../domain/forecast'
import { useFavorites } from '../../hooks/useFavorites'
import { useNearbyAreas } from '../../hooks/useNearbyAreas'

/** 시안의 "근처 쾌적한 장소"에 몇 곳까지 띄울지. */
const NEARBY_CALM_LIMIT = 2

interface Props {
  readonly areaName: string
  readonly onBack: () => void
  /** "근처 쾌적한 장소"에서 다른 명소로 갈아탈 때. */
  readonly onSelectArea: (name: string) => void
}

// 옛 ForecastScreen의 본문에 접이식 도시 정보(옛 MoreScreen)를 더한 것이다.
// 상단바와 뒤로가기는 없다 — 목록 자리에만 들어가고 지도는 위에 그대로 남는다.
export function AreaDetail({ areaName, onBack, onSelectArea }: Props) {
  const entry = findAreaByName(areaName)

  // 카탈로그에 없는 이름은 조회하지 않는다. 프록시의 허용 목록에 걸려 400이 오고
  // 그 실패가 캐시될 뿐이다.
  const query = useAreaSnapshot(entry === undefined ? undefined : areaName)
  const { isFavorite, toggle } = useFavorites()

  // 접힌 동안은 areaName을 넘기지 않아 useCityInfo의 enabled가 false가 된다.
  // 하루 1,000회 제한을 혼잡도와 나눠 쓰므로 상세를 열 때마다 부르면 안 된다.
  const [cityInfoOpen, setCityInfoOpen] = useState(false)
  const cityInfo = useCityInfo(cityInfoOpen ? areaName : undefined)

  // 홈이 이미 받아둔 캐시를 그대로 쓴다. 추가 호출이 나가지 않는다.
  const location = useLocation()
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const { recommended } = useNearbyAreas(snapshots.data ?? [], location.coords, '전체')

  const starred = isFavorite(areaName)
  const snapshot = query.data
  const info = cityInfo.data

  const header = (
    <div className="flex items-center justify-between px-4 py-2">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-12 items-center gap-1 text-label-md font-semibold text-primary"
      >
        <Icon name="back" className="size-4" />
        목록으로
      </button>
      <button
        type="button"
        aria-label={starred ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
        aria-pressed={starred}
        onClick={() => toggle(areaName)}
        className="min-h-12 px-2 text-primary"
      >
        <Icon name={starred ? 'starFilled' : 'star'} className="size-5" />
      </button>
    </div>
  )

  if (entry === undefined) {
    return (
      <div className="pb-6">
        {header}
        <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
          명소를 찾을 수 없어요.
        </p>
      </div>
    )
  }

  const quietHour =
    snapshot === undefined
      ? null
      : findQuietTime(snapshot.congestion, snapshot.forecasts)

  // 지금 보고 있는 곳은 "다른 데 가보라"는 추천에서 뺀다.
  const alternatives = recommended
    .filter((area) => area.entry.name !== entry.name)
    .slice(0, NEARBY_CALM_LIMIT)

  return (
    <div className="flex flex-col gap-3 pb-6">
      {header}

      <h2 className="px-4 text-headline-md text-on-surface">{entry.name}</h2>

      {query.isPending && (
        <div className="px-4">
          <SkeletonList count={3} />
        </div>
      )}

      {query.isError && (
        <div className="px-4">
          <ErrorState
            message="혼잡도 정보를 가져오지 못했어요."
            onRetry={() => void query.refetch()}
          />
        </div>
      )}

      {snapshot !== undefined && (
        <>
          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            <CongestionBadge level={snapshot.congestion} emphasis />
            <p className="mt-2 text-display-lg text-on-surface">
              {congestionHeadline(snapshot.congestion)}
            </p>
            <p className="mt-1 text-label-sm text-outline">
              마지막 업데이트: {snapshot.observedAtLabel}
            </p>

            {quietHour !== null && (
              <div className="mt-4 flex gap-2 rounded-card bg-secondary-container px-3 py-3">
                <Icon name="info" className="size-5 text-primary" />
                <p className="text-label-md leading-6 text-on-surface">
                  <span className="font-bold text-primary">
                    {quietHour}시엔 여유 예상
                  </span>{' '}
                  한산한 시간을 원하시면 조금만 기다려주세요.
                </p>
              </div>
            )}

            <p className="mt-4 text-body-md leading-6 text-on-surface">
              {snapshot.message}
            </p>
            <p className="mt-2 text-label-md text-on-surface-variant">
              추정 인구 {snapshot.populationMin.toLocaleString()}~
              {snapshot.populationMax.toLocaleString()}명
            </p>
          </section>

          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            <h3 className="text-headline-sm text-on-surface">시간별 예측</h3>
            <div className="mt-3">
              <ForecastChart forecasts={snapshot.forecasts} />
            </div>
          </section>

          <ActionButtons entry={entry} />
        </>
      )}

      {/* 도시 정보는 접힌 채로 시작한다. 여기가 쿼터를 지키는 자리다. */}
      <section className="mx-4 rounded-card border border-outline-variant">
        <button
          type="button"
          aria-expanded={cityInfoOpen}
          onClick={() => setCityInfoOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between px-4 text-label-md font-semibold text-on-surface"
        >
          이곳의 도시 정보
          <Icon name={cityInfoOpen ? 'chevronUp' : 'chevronDown'} className="size-4" />
        </button>

        {cityInfoOpen && (
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

      {alternatives.length > 0 && (
        <section className="mx-4 rounded-card bg-secondary-container p-4">
          <h3 className="text-headline-sm text-primary">근처 쾌적한 장소</h3>
          <p className="mt-1 text-label-md text-on-surface-variant">
            여기가 너무 붐비나요? 2km 안에서 한산한 곳이에요.
          </p>
          <div className="mt-3">
            <AreaList>
              {alternatives.map((area) => (
                <AreaListItem
                  key={area.entry.code}
                  area={area}
                  onSelect={onSelectArea}
                />
              ))}
            </AreaList>
          </div>
        </section>
      )}
    </div>
  )
}
