import { useState } from 'react'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AreaListItem } from '../components/nearby/AreaListItem'
import {
  CategoryFilter,
  type CategoryFilterValue,
} from '../components/nearby/CategoryFilter'
import { AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import { useNearbyAreas } from '../hooks/useNearbyAreas'

interface Props {
  readonly onSelectArea: (name: string) => void
}

export function NearbyScreen({ onSelectArea }: Props) {
  const [category, setCategory] = useState<CategoryFilterValue>('전체')
  const snapshots = useAreaSnapshots(AREA_NAMES)

  // 위치 훅(T13)은 아직이다. coords가 null이면 혼잡도 낮은 순으로 정렬된다 —
  // 위치 권한을 거부한 사용자에게도 그대로 쓸 대체 동작이다.
  const { list } = useNearbyAreas(snapshots.data ?? [], null, category)

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="px-4 pt-4">
        <h2 className="text-2xl font-bold text-on-surface">내 주변 명소</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          서울 {AREA_NAMES.length}곳 실시간 혼잡도
        </p>
      </section>

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
        <section className="px-4">
          <h3 className="text-lg font-bold text-on-surface">혼잡도 낮은 순</h3>
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
      )}
    </div>
  )
}
