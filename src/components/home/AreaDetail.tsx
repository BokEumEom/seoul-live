import { AreaHero } from './AreaHero'
import { CityInfoPanel } from './CityInfoPanel'
import { CongestionCard } from './CongestionCard'
import { NearbyCalmSection } from './NearbyCalmSection'
import { WeeklyPatternCard } from './WeeklyPatternCard'
import { useLocation } from '../../app/locationContext'
import { findAreaByName } from '../../data/areas'
import { useAreaSnapshot } from '../../data/queries'
import { useFavorites } from '../../hooks/useFavorites'
import { ErrorState } from '../common/ErrorState'
import { Icon } from '../common/Icon'
import { SkeletonList } from '../common/SkeletonCard'
import { useWeekPattern } from '../../hooks/useWeekPattern'
import { ActionButtons } from './ActionButtons'
import { ForecastChart } from '../forecast/ForecastChart'

interface Props {
  readonly areaName: string
  readonly onBack: () => void
  /** "근처 쾌적한 장소"에서 다른 명소로 갈아탈 때. */
  readonly onSelectArea: (name: string) => void
}

// 상세의 절 순서를 소유하는 파일이다. 각 절의 내용은 옆 파일들이 갖는다 —
// 여기서 결정되는 것은 「무엇이 어떤 차례로 오는가」뿐이고, 그 차례가 곧
// 설계 §2.6의 Google Maps 장소 카드 순서다.
// 상단바와 뒤로가기 화살표는 없다 — 목록 자리에만 들어가고 지도는 위에 남는다.
export function AreaDetail({ areaName, onBack, onSelectArea }: Props) {
  const entry = findAreaByName(areaName)

  // 카탈로그에 없는 이름은 조회하지 않는다. 프록시의 허용 목록에 걸려 400이 오고
  // 그 실패가 캐시될 뿐이다.
  const query = useAreaSnapshot(entry === undefined ? undefined : areaName)
  const { isFavorite, toggle } = useFavorites()
  const location = useLocation()

  const starred = isFavorite(areaName)
  const snapshot = query.data
  // 상세를 열 때마다 이 명소의 지금 혼잡도를 한 칸 쌓는다. 서울 API가 과거를
  // 주지 않아 패턴을 조회할 수 없고, 쌓는 것 말고 방법이 없다 — PLAN.md 4차.
  const pattern = useWeekPattern(entry?.name, snapshot)

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

  return (
    <div className="flex flex-col gap-3 pb-6">
      {header}

      <AreaHero entry={entry} coords={location.coords} level={snapshot?.congestion} />

      {/* 설계 §2.6의 2번 자리다 — 히어로 바로 다음. 예측 뒤에 두면 저장 버튼이
          어느 대상 기기에서도 폴드 밖이라, 헤더의 별이 늘 보이던 것보다 못해진다.
          혼잡도 응답 밖인 이유는 카탈로그만 있으면 길찾기·공유·저장이 성립하기
          때문이다 — API가 흔들린 날 이 셋까지 사라지면 안 된다.
          즐겨찾기라는 사실은 여기 남는다. 넘기는 건 눌림 상태와 콜백뿐이다.

          key를 명소 이름으로 두는 이유: 「근처 쾌적한 장소」로 갈아타면 이
          컴포넌트가 언마운트되지 않아 저장 알림 리전에 앞 명소 문구가 남는다.
          다시 낭독되지는 않지만 리전을 훑는 사용자에게는 지금 화면과 무관한
          말이 적혀 있게 된다. */}
      <ActionButtons
        key={entry.name}
        entry={entry}
        saved={starred}
        onSave={() => toggle(areaName)}
      />

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
          <CongestionCard snapshot={snapshot} />

          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            {/* "예측"은 시스템 용어에 가깝다. Google Maps의 「인기 시간대」 자리다. */}
            <h3 className="text-headline-sm text-on-surface">시간대별 예상</h3>
            <div className="mt-3">
              <ForecastChart forecasts={snapshot.forecasts} />
            </div>
          </section>

          {/* 시안(stitch_ui/_3)의 순서 그대로 시간축 바로 아래다. 예측이
              「오늘 앞으로」를 말하고 이 표가 「평소 이맘때」를 말한다. */}
          <WeeklyPatternCard pattern={pattern} now={new Date()} />
        </>
      )}

      <CityInfoPanel areaName={areaName} />

      <NearbyCalmSection exclude={entry.name} onSelectArea={onSelectArea} />
    </div>
  )
}
