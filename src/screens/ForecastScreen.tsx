import { CongestionBadge } from '../components/common/CongestionBadge'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { ActionButtons } from '../components/forecast/ActionButtons'
import { ForecastChart } from '../components/forecast/ForecastChart'
import { TopAppBar } from '../components/layout/TopAppBar'
import { findAreaByName } from '../data/areas'
import { useAreaSnapshot } from '../data/queries'
import { findQuietTime } from '../domain/forecast'

interface Props {
  readonly areaName: string
  readonly onBack: () => void
}

export function ForecastScreen({ areaName, onBack }: Props) {
  const entry = findAreaByName(areaName)

  // 카탈로그에 없는 이름은 조회하지 않는다. 프록시의 허용 목록에 걸려 400이 오고
  // 그 실패가 캐시될 뿐이다.
  const query = useAreaSnapshot(entry === undefined ? undefined : areaName)

  if (entry === undefined) {
    return (
      <div>
        <TopAppBar title="혼잡예보" onBack={onBack} />
        <p className="px-4 py-10 text-center text-sm text-on-surface-variant">
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

  return (
    <div className="flex flex-col gap-4 pb-6">
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
            <CongestionBadge level={snapshot.congestion} />
            <p className="mt-2 text-sm text-on-surface-variant">
              {snapshot.observedAtLabel} 기준
            </p>
            <p className="mt-3 text-sm leading-6 text-on-surface">
              {snapshot.message}
            </p>
            <p className="mt-3 text-sm text-on-surface-variant">
              추정 인구 {snapshot.populationMin.toLocaleString()}~
              {snapshot.populationMax.toLocaleString()}명
            </p>
          </section>

          {quietHour !== null && (
            <section className="mx-4 rounded-card bg-secondary-container px-4 py-3">
              <p className="text-sm leading-6 text-on-surface">
                <span className="font-bold text-primary">
                  {quietHour}시엔 여유 예상
                </span>{' '}
                한산한 시간을 원하시면 조금만 기다려주세요.
              </p>
            </section>
          )}

          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            <h3 className="text-base font-bold text-on-surface">시간별 예측</h3>
            <div className="mt-3">
              <ForecastChart forecasts={snapshot.forecasts} />
            </div>
          </section>

          <ActionButtons entry={entry} />
        </>
      )}
    </div>
  )
}
