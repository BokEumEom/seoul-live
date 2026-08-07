import { useState } from 'react'
import { ErrorState } from '../components/common/ErrorState'
import { Icon } from '../components/common/Icon'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AreaListItem } from '../components/nearby/AreaListItem'
import { CategoryFilter } from '../components/nearby/CategoryFilter'
import { LocationNotice } from '../components/nearby/LocationNotice'
import { RecommendationCard } from '../components/nearby/RecommendationCard'
import { SortSegmented } from '../components/nearby/SortSegmented'
import { useLocation } from '../app/locationContext'
import { AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import {
  useNearbyAreas,
  type CategoryFilterValue,
  type SortMode,
} from '../hooks/useNearbyAreas'

// 좌표가 없을 때 거리순을 고르면 목록은 여유한 순으로 내려간다. 제목도
// 실제 정렬을 따라가야 한다 — "거리순"이라고 써놓고 다르게 정렬하면
// 사용자가 목록을 잘못 읽는다.
const SORT_HEADING: Readonly<Record<SortMode, string>> = {
  distance: '거리순 주변 장소',
  calm: '여유한 순 주변 장소',
  busy: '붐비는 순 주변 장소',
}

interface Props {
  readonly onSelectArea: (name: string) => void
}

export function NearbyScreen({ onSelectArea }: Props) {
  const [category, setCategory] = useState<CategoryFilterValue>('전체')
  const [sort, setSort] = useState<SortMode>('distance')
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()

  // 좌표가 없으면 무엇을 골라도 혼잡도순으로 내려간다. 위치를 거부한 사용자도
  // 빈 화면 대신 쓸 수 있는 목록을 본다.
  const { list, recommended } = useNearbyAreas(
    snapshots.data ?? [],
    location.coords,
    category,
    sort,
  )

  const hasLocation = location.coords !== null
  const ready = !snapshots.isPending && !snapshots.isError

  return (
    <div className="relative flex flex-col gap-4 pb-6">
      <section className="px-4 pt-4">
        <h2 className="text-headline-md text-on-surface">내 주변 명소</h2>
        <p className="mt-1 text-label-md text-on-surface-variant">
          {hasLocation ? '현재 위치 기반' : '서울 도심'} 실시간 혼잡도 · 총{' '}
          {AREA_NAMES.length}곳
        </p>
      </section>

      <LocationNotice status={location.status} onRetry={location.retry} />

      <CategoryFilter value={category} onChange={setCategory} />

      {snapshots.isPending && (
        <div className="px-4">
          <SkeletonList count={6} />
        </div>
      )}

      {snapshots.isError && (
        <div className="px-4">
          <ErrorState
            message="혼잡도 정보를 가져오지 못했어요."
            onRetry={() => void snapshots.refetch()}
          />
        </div>
      )}

      {ready && (
        <>
          {recommended.length > 0 && (
            <section>
              <h3 className="px-4 text-headline-sm text-on-surface">
                가까우면서 여유로운 곳 추천
              </h3>
              {/* 가로 스크롤. 아래 목록과 같은 세로 행으로 두면 두 섹션이
                  구분되지 않아 추천이 눈에 띄지 않는다. */}
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

          <section className="px-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-headline-sm text-on-surface">
                {SORT_HEADING[
                  sort === 'distance' && !hasLocation ? 'calm' : sort
                ]}
              </h3>
              <SortSegmented
                value={sort}
                onChange={setSort}
                canSortByDistance={hasLocation}
              />
            </div>

            {list.length === 0 ? (
              <p className="mt-6 text-center text-body-md text-on-surface-variant">
                이 카테고리에 해당하는 명소가 없어요.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {list.map((area) => (
                  <AreaListItem
                    key={area.entry.code}
                    area={area}
                    onSelect={onSelectArea}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* 시안의 우하단 FAB. 지도가 없으니 "지도 다시 맞추기" 대신 위치를 다시
          잡는 역할을 맡는다. */}
      <button
        type="button"
        onClick={location.retry}
        aria-label="현재 위치 다시 확인"
        className="sticky bottom-4 left-full mr-4 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-floating"
      >
        <Icon name="myLocation" />
      </button>
    </div>
  )
}
