import { useState } from 'react'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AreaListItem } from '../components/nearby/AreaListItem'
import { CategoryFilter } from '../components/nearby/CategoryFilter'
import { LocationNotice } from '../components/nearby/LocationNotice'
import { AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import { useCurrentLocation } from '../hooks/useCurrentLocation'
import {
  useNearbyAreas,
  type CategoryFilterValue,
} from '../hooks/useNearbyAreas'

interface Props {
  readonly onSelectArea: (name: string) => void
}

export function NearbyScreen({ onSelectArea }: Props) {
  const [category, setCategory] = useState<CategoryFilterValue>('전체')
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useCurrentLocation()

  // 좌표가 없으면 혼잡도 낮은 순으로 내려간다. 위치를 거부한 사용자도
  // 빈 화면 대신 쓸 수 있는 목록을 본다.
  const { list, recommended } = useNearbyAreas(
    snapshots.data ?? [],
    location.coords,
    category,
  )

  const sortedByDistance = location.coords !== null

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="px-4 pt-4">
        <h2 className="text-2xl font-bold text-on-surface">내 주변 명소</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          서울 {AREA_NAMES.length}곳 실시간 혼잡도
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

      {!snapshots.isPending && !snapshots.isError && (
        <>
          {recommended.length > 0 && (
            <section className="px-4">
              <h3 className="text-lg font-bold text-on-surface">
                지금 가기 좋은 곳
              </h3>
              <p className="mt-0.5 text-sm text-on-surface-variant">
                2km 안에서 한산한 곳
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {recommended.map((area) => (
                  <AreaListItem
                    key={area.entry.code}
                    area={area}
                    onSelect={onSelectArea}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="px-4">
            <h3 className="text-lg font-bold text-on-surface">
              {sortedByDistance ? '가까운 순' : '혼잡도 낮은 순'}
            </h3>
            {list.length === 0 ? (
              <p className="mt-6 text-center text-sm text-on-surface-variant">
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
    </div>
  )
}
