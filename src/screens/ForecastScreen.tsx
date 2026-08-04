import { useLocation } from '../app/locationContext'
import { CongestionBadge } from '../components/common/CongestionBadge'
import { ErrorState } from '../components/common/ErrorState'
import { Icon } from '../components/common/Icon'
import { SkeletonList } from '../components/common/SkeletonCard'
import { ActionButtons } from '../components/forecast/ActionButtons'
import { ForecastChart } from '../components/forecast/ForecastChart'
import { TopAppBar } from '../components/layout/TopAppBar'
import { AreaListItem } from '../components/nearby/AreaListItem'
import { AREA_NAMES, findAreaByName } from '../data/areas'
import { useAreaSnapshot, useAreaSnapshots } from '../data/queries'
import { congestionHeadline } from '../domain/congestion'
import { findQuietTime } from '../domain/forecast'
import { useNearbyAreas } from '../hooks/useNearbyAreas'

/** 시안의 "근처 쾌적한 장소"에 몇 곳까지 띄울지. */
const NEARBY_CALM_LIMIT = 2

interface Props {
  readonly areaName: string
  readonly onBack: () => void
  /** "근처 쾌적한 장소"에서 다른 명소로 갈아탈 때. */
  readonly onSelectArea: (name: string) => void
}

export function ForecastScreen({ areaName, onBack, onSelectArea }: Props) {
  const entry = findAreaByName(areaName)

  // 카탈로그에 없는 이름은 조회하지 않는다. 프록시의 허용 목록에 걸려 400이 오고
  // 그 실패가 캐시될 뿐이다.
  const query = useAreaSnapshot(entry === undefined ? undefined : areaName)

  // 내 주변 화면이 이미 받아둔 캐시를 그대로 쓴다. 추가 호출이 나가지 않는다.
  const location = useLocation()
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const { recommended } = useNearbyAreas(
    snapshots.data ?? [],
    location.coords,
    '전체',
  )

  if (entry === undefined) {
    return (
      <div>
        <TopAppBar title="혼잡예보" onBack={onBack} />
        <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
          명소를 찾을 수 없어요.
        </p>
      </div>
    )
  }

  const snapshot = query.data
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
      <TopAppBar title={entry.name} onBack={onBack} />

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

          {alternatives.length > 0 && (
            <section className="mx-4 rounded-card bg-secondary-container p-4">
              <h3 className="text-headline-sm text-primary">
                근처 쾌적한 장소
              </h3>
              <p className="mt-1 text-label-md text-on-surface-variant">
                여기가 너무 붐비나요? 2km 안에서 한산한 곳이에요.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {alternatives.map((area) => (
                  <AreaListItem
                    key={area.entry.code}
                    area={area}
                    onSelect={onSelectArea}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
