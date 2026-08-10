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
import { PopulationCard } from './PopulationCard'
import { AREA_NAMES, findAreaByName } from '../../data/areas'
import { useAreaSnapshot, useAreaSnapshots, useCityInfo } from '../../data/queries'
import { hasAnyCityInfo } from '../../domain/cityInfo'
import { congestionHeadline } from '../../domain/congestion'
import { formatDistance, haversineMeters, walkingMinutes } from '../../domain/distance'
import { findQuietTime } from '../../domain/forecast'
import { CATEGORY_LABEL } from '../../domain/types'
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

  // 별은 여기 없다. 아이콘뿐인 별은 무엇인지 알 수 없어서 액션 행의 「저장」이
  // 됐다(설계 §2.6). w-fit이 없으면 flex 열의 자식이라 폭 전체가 뒤로가기
  // 타깃이 된다.
  const header = (
    <button
      type="button"
      onClick={onBack}
      className="flex min-h-12 w-fit items-center gap-1 px-4 text-label-md font-semibold text-primary"
    >
      <Icon name="back" className="size-4" />
      목록으로
    </button>
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

  // 위치를 아직 못 잡았거나 거부하면 거리 구간만 빠지고 카테고리는 남는다.
  // AreaListItem과 같은 처리다.
  const distanceMeters =
    location.coords === null ? null : haversineMeters(location.coords, entry)

  // 별 아이콘만 있던 헤더 버튼을 글자 있는 버튼으로 옮긴 것이다. 라벨이
  // 상태를 말하므로 aria-pressed는 쓰지 않는다 — 함께 쓰면 스크린리더가
  // "저장됨, 선택됨"처럼 같은 상태를 두 번 읽는다.
  const saveButton = (
    <button
      type="button"
      onClick={() => toggle(areaName)}
      className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action border text-label-md font-semibold text-primary ${
        starred
          ? 'border-secondary-container bg-secondary-container'
          : 'border-outline-variant bg-surface-container-lowest'
      }`}
    >
      <Icon name={starred ? 'starFilled' : 'star'} className="size-5" />
      {starred ? '저장됨' : '저장'}
    </button>
  )

  // 지금 보고 있는 곳은 "다른 데 가보라"는 추천에서 뺀다.
  const alternatives = recommended
    .filter((area) => area.entry.name !== entry.name)
    .slice(0, NEARBY_CALM_LIMIT)

  return (
    <div className="flex flex-col gap-3 pb-6">
      {header}

      {/* Google Maps 장소 카드의 히어로 순서다 — 이름, 카테고리·거리·도보 시간,
          그리고 오른쪽에 상태 배지. 도보 시간은 domain/distance의
          walkingMinutes가 유일한 출처다. 여기서 다시 환산하면
          RecommendationCard와 조용히 갈린다. */}
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-headline-md text-on-surface">{entry.name}</h2>
          {/* `!== null`이지 truthy 검사가 아니다. 명소 위에 서 있으면 거리가
              0이라 `distanceMeters &&`로 쓰면 이 줄이 카테고리만 남는다. */}
          <p className="mt-0.5 text-label-sm text-on-surface-variant">
            {CATEGORY_LABEL[entry.category]}
            {distanceMeters !== null &&
              ` · ${formatDistance(distanceMeters)} · 도보 ${walkingMinutes(distanceMeters)}분`}
          </p>
        </div>
        {snapshot !== undefined && <CongestionBadge level={snapshot.congestion} />}
      </div>

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
          {/* 배지는 히어로가 갖는다. 여기 한 번 더 두면 「약간 붐빔」이 바로
              아래 제목("다소 혼잡")까지 셋이 같은 말을 하고, 그 36px이
              인구 구성을 폴드 밖으로 민다. */}
          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            <p className="text-display-lg text-on-surface">
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

            {/* 설계 §2.6은 이 카드를 예측 다음에 놓지만 여기로 올렸다. 390px
                실측에서 예측 섹션이 262px이라, 그 아래면 720~740px급
                안드로이드(시트 full이 가용 약 640px)에서 제목만 보이고 막대는
                폴드 밖으로 나간다. 「인파레이더 대신 쓸 이유」를 만드는 카드를
                보이지 않는 자리에 두지 않는다.
                감싸는 <div>를 두지 않는 이유도 같다 — PopulationCard는 읽을 수
                있는 값이 하나도 없으면 null을 돌려주므로, 이 카드 안에 직접
                넣어야 사라진 자리에 빈 칸이 남지 않는다. mt-4 border-t는 그
                카드가 이미 갖고 있어 여기서는 여백을 더하지 않는다. */}
            {snapshot.composition !== null && (
              <PopulationCard composition={snapshot.composition} />
            )}
          </section>

          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            {/* "예측"은 시스템 용어에 가깝다. Google Maps의 「인기 시간대」 자리다. */}
            <h3 className="text-headline-sm text-on-surface">시간대별 예상</h3>
            <div className="mt-3">
              <ForecastChart forecasts={snapshot.forecasts} />
            </div>
          </section>
        </>
      )}

      {/* 액션 행은 카탈로그만 있으면 성립한다. 혼잡도 응답 안에 두면 API가
          흔들린 날 저장·길찾기·공유가 통째로 사라진다. */}
      <ActionButtons entry={entry}>{saveButton}</ActionButtons>

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
