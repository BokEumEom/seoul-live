import { useMemo } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AreaList } from '../components/list/AreaList'
import { AreaListItem } from '../components/list/AreaListItem'
import { AREA_CATALOG, AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import { useFavorites } from '../hooks/useFavorites'
import { buildNearbyList } from '../hooks/useNearbyAreas'

interface Props {
  readonly onSelectArea: (name: string) => void
  readonly onGoHome: () => void
}

export function FavoritesScreen({ onSelectArea, onGoHome }: Props) {
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()
  const { favorites } = useFavorites()

  // 홈이 이미 받아둔 캐시를 그대로 쓴다. 추가 호출이 나가지 않는다.
  const list = useMemo(
    () =>
      buildNearbyList({
        entries: AREA_CATALOG,
        snapshots: snapshots.data ?? [],
        coords: location.coords,
        category: '전체',
      }),
    [snapshots.data, location.coords],
  )

  const starred = list.filter((area) => favorites.includes(area.entry.name))

  return (
    <div className="flex flex-col gap-3 pb-6">
      <section className="px-4 pt-4">
        <h2 className="text-headline-md text-on-surface">즐겨찾기</h2>
        <p className="mt-1 text-label-md text-on-surface-variant">
          이 기기에 저장돼요
        </p>
      </section>

      {snapshots.isError && (
        <div className="px-4">
          <ErrorState
            message="혼잡도 정보를 가져오지 못했어요."
            onRetry={() => void snapshots.refetch()}
          />
        </div>
      )}

      {snapshots.isPending && starred.length > 0 && (
        <div className="px-4">
          <SkeletonList count={starred.length} />
        </div>
      )}

      {/* 빈 화면만 두면 이 탭이 고장 난 것으로 읽힌다. 담는 방법과 갈 곳을 준다. */}
      {starred.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-body-md text-on-surface-variant">
            지도에서 ☆를 눌러 담아보세요
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="mt-4 min-h-12 rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary"
          >
            지도로 가기
          </button>
        </div>
      ) : (
        <div className="px-4">
          <AreaList>
            {starred.map((area) => (
              <AreaListItem
                key={area.entry.code}
                area={area}
                onSelect={onSelectArea}
              />
            ))}
          </AreaList>
        </div>
      )}
    </div>
  )
}
