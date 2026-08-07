import { useMemo } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AlertDigest } from '../components/today/AlertDigest'
import { CategoryAverages } from '../components/today/CategoryAverages'
import { RankList } from '../components/today/RankList'
import { RecommendationCard } from '../components/today/RecommendationCard'
import { SummaryCard } from '../components/today/SummaryCard'
import { AREA_CATALOG, AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import {
  categoryAverages,
  summarize,
  topBusiest,
  topCalmest,
} from '../domain/summary'
import { useCachedCityAlerts } from '../hooks/useCachedCityAlerts'
import { buildNearbyList, pickRecommendations } from '../hooks/useNearbyAreas'

/** TOP 목록에 몇 곳까지 띄울지. */
const RANK_LIMIT = 5

interface Props {
  readonly onSelectArea: (name: string) => void
}

// 지도가 공간적 조망을 준다면 여기는 전체 조망을 준다. "30곳 중 붐빔 5곳"
// 같은 건 지도를 아무리 봐도 안 보인다.
//
// **useCityInfo를 부르지 않는다.** 추가 호출이 0이라는 것이 이 화면의 존재
// 근거다. 재난문자는 상세에서 이미 받아둔 캐시에 있는 것만 모은다.
export function TodayScreen({ onSelectArea }: Props) {
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()
  const alerts = useCachedCityAlerts()

  const list = useMemo(
    () =>
      buildNearbyList({
        entries: AREA_CATALOG,
        snapshots: snapshots.data ?? [],
        coords: location.coords,
        category: '전체',
        // 추천은 항상 가까운 순으로 뽑는다 — 섹션 이름이 곧 정렬 기준이다.
        sort: 'distance',
      }),
    [snapshots.data, location.coords],
  )

  const summary = summarize(list)
  const busiest = topBusiest(list, RANK_LIMIT)
  const calmest = topCalmest(list, RANK_LIMIT)
  const averages = categoryAverages(list)
  const recommended = pickRecommendations(list)

  return (
    <div className="flex flex-col gap-1 pb-6">
      <section className="px-4 pt-4">
        <h2 className="text-headline-md text-on-surface">오늘의 서울</h2>
        <p className="mt-1 text-label-md text-on-surface-variant">
          지도에 안 보이는 전체 그림
        </p>
      </section>

      {snapshots.isPending && (
        <div className="px-4 pt-3">
          <SkeletonList count={4} />
        </div>
      )}

      {snapshots.isError && (
        <div className="px-4 pt-3">
          <ErrorState
            message="혼잡도 정보를 가져오지 못했어요."
            onRetry={() => void snapshots.refetch()}
          />
        </div>
      )}

      {!snapshots.isPending && !snapshots.isError && (
        <>
          <div className="pt-3">
            <SummaryCard summary={summary} />
          </div>

          <AlertDigest alerts={alerts} />

          <RankList
            title="지금 가장 붐비는 곳"
            areas={busiest}
            onSelect={onSelectArea}
          />

          <RankList
            title="지금 여유로운 곳"
            areas={calmest}
            onSelect={onSelectArea}
          />

          <CategoryAverages rows={averages} />

          {recommended.length > 0 && (
            <section className="mt-3">
              <h3 className="px-4 text-headline-sm text-on-surface">
                가까우면서 여유로운 곳 추천
              </h3>
              {/* 가로 스크롤. 「내 주변」이 없어지면서 갈 곳을 잃은 캐러셀이다. */}
              <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
                {recommended.map((area) => (
                  <RecommendationCard
                    key={area.entry.code}
                    area={area}
                    onSelect={onSelectArea}
                  />
                ))}
              </div>
            </section>
          )}

          <p className="mt-6 px-4 text-label-sm text-outline">
            출처: 서울 열린데이터광장 실시간 도시데이터 · 5분마다 갱신
          </p>
        </>
      )}
    </div>
  )
}
