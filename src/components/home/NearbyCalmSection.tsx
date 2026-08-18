import { t } from '../../i18n/t'
import { useLocation } from '../../app/locationContext'
import { AREA_NAMES } from '../../data/areas'
import { useAreaSnapshots } from '../../data/queries'
import { useNearbyAreas } from '../../hooks/useNearbyAreas'
import { AreaList } from '../list/AreaList'
import { AreaListItem } from '../list/AreaListItem'

/** 시안의 "근처 쾌적한 장소"에 몇 곳까지 띄울지. */
const NEARBY_CALM_LIMIT = 2

interface Props {
  /** 지금 보고 있는 명소. "다른 데 가보라"는 추천에서 뺀다. */
  readonly exclude: string
  readonly onSelectArea: (name: string) => void
}

// 홈이 이미 받아둔 캐시를 그대로 쓴다. 추가 호출이 나가지 않는다.
export function NearbyCalmSection({ exclude, onSelectArea }: Props) {
  const location = useLocation()
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const { recommended } = useNearbyAreas(snapshots.data ?? [], location.coords, '전체')

  const alternatives = recommended
    .filter((area) => area.entry.name !== exclude)
    .slice(0, NEARBY_CALM_LIMIT)

  if (alternatives.length === 0) {
    return null
  }

  return (
    <section className="mx-4 rounded-card bg-secondary-container p-4">
      <h3 className="text-headline-sm text-primary">{t('근처 쾌적한 장소')}</h3>
      <p className="mt-1 text-label-md text-on-surface-variant">
        {t('여기가 너무 붐비나요? 2km 안에서 한산한 곳이에요.')}
      </p>
      <div className="mt-3">
        <AreaList>
          {alternatives.map((area) => (
            <AreaListItem key={area.entry.code} area={area} onSelect={onSelectArea} />
          ))}
        </AreaList>
      </div>
    </section>
  )
}
