import { t } from '../../i18n/t'
import { AreaHero } from './AreaHero'
import { CityInfoChips } from './CityInfoChips'
import { CityInfoPanel } from './CityInfoPanel'
import { CongestionCard } from './CongestionCard'
import { PopulationLead } from './PopulationLead'
import { NearbyCalmSection } from './NearbyCalmSection'
import { WeeklyPatternCard } from './WeeklyPatternCard'
import { useLocation } from '../../app/locationContext'
import { findAreaByName } from '../../data/areas'
import { useAreaSnapshot } from '../../data/queries'
import type { FacilityLocation } from '../../domain/cityInfo'
import { ErrorState } from '../common/ErrorState'
import { Icon } from '../common/Icon'
import { SkeletonList } from '../common/SkeletonCard'
import { useWeekPattern } from '../../hooks/useWeekPattern'
import { ActionButtons } from './ActionButtons'
import { MapLinkButtons } from './MapLinkButtons'
import { CctvSection } from '../cityinfo/CctvSection'
import { ForecastChart } from '../forecast/ForecastChart'

interface Props {
  readonly areaName: string
  readonly onBack: () => void
  /** "근처 쾌적한 장소"에서 다른 명소로 갈아탈 때. */
  readonly onSelectArea: (name: string) => void
  /** 주차장·따릉이 줄의 아이콘이 누르는 것. 지도는 `HomeScreen`이 갖는다. */
  readonly onShowOnMap: (place: FacilityLocation) => void
  /** 지금 펼쳐 둔 CCTV. 지도 마커와 시트가 나눠 갖는 상태라 위에서 내려온다. */
  readonly openCctvStreamUrl: string | null
  readonly onToggleCctv: (streamUrl: string) => void
}

// 상세의 절 순서를 소유하는 파일이다. 각 절의 내용은 옆 파일들이 갖는다 —
// 여기서 결정되는 것은 「무엇이 어떤 차례로 오는가」뿐이고, 그 차례가 곧
// 설계 §2.6의 Google Maps 장소 카드 순서다.
// 상단바와 뒤로가기 화살표는 없다 — 목록 자리에만 들어가고 지도는 위에 남는다.
export function AreaDetail({
  areaName,
  onBack,
  onSelectArea,
  onShowOnMap,
  openCctvStreamUrl,
  onToggleCctv,
}: Props) {
  const entry = findAreaByName(areaName)

  // 카탈로그에 없는 이름은 조회하지 않는다. 프록시의 허용 목록에 걸려 400이 오고
  // 그 실패가 캐시될 뿐이다.
  const query = useAreaSnapshot(entry === undefined ? undefined : areaName)
  const location = useLocation()

  const snapshot = query.data
  // 상세를 열 때마다 이 명소의 지금 혼잡도를 한 칸 쌓는다. 서울 API가 과거를
  // 주지 않아 패턴을 조회할 수 없고, 쌓는 것 말고 방법이 없다 — PLAN.md 4차.
  const pattern = useWeekPattern(entry?.name, snapshot)

  // 뒤로가기. `w-fit`이 없으면 flex 열의 자식이라 폭 전체가 뒤로가기 타깃이
  // 된다.
  //
  // (예전에 여기 「아이콘뿐인 별은 무엇인지 알 수 없어서 액션 행의 「저장」이
  // 됐다」고 적혀 있었다. 2026-08-19에 별이 다시 아이콘이 됐으므로 낡았다 —
  // 지금 그 걱정을 받는 것은 `aria-label`과 윤곽/채움 두 글리프다.)
  const header = (
    <button
      type="button"
      onClick={onBack}
      className="flex min-h-12 w-fit items-center gap-1 px-4 text-label-md font-semibold text-primary"
    >
      <Icon name="back" className="size-4" />
      {t('목록으로')}
    </button>
  )

  if (entry === undefined) {
    return (
      <div className="pb-6">
        {header}
        <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
          {t('명소를 찾을 수 없어요.')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      {header}

      {/* 즐겨찾기·인스타그램·공유가 **제목 줄 안**에 있다 — 샘플(서울
          인파레이더)의 배치다. 예전에는 히어로 아래 별도의 48px 행이었는데,
          그 행과 여백을 합쳐 72px을 아꼈다(근거는 `ActionButtons`의 주석).
          **길찾기 셋은 여기 없다. 맨 아래로 내려갔다**(`MapLinkButtons`) —
          저장은 다 읽기 전에도 하고 싶을 수 있지만 길찾기는 다 읽은 뒤에
          하는 일이라서다. 혼잡도 응답 밖인 이유는 카탈로그만 있으면 이 셋이
          성립하기 때문이다 — API가 흔들린 날까지 사라지면 안 된다.
          **즐겨찾기 구독은 여기 없다.** `ActionButtons` 안에 있다 — 그 값을
          읽는 곳이 거기뿐이다. 다만 그 이동만으로 다시 그려지는 범위가 줄지는
          않는다(`HomeScreen`도 구독한다). 실측과 근거는 그 파일의 주석.

          key를 명소 이름으로 두는 이유: 「근처 쾌적한 장소」로 갈아타면 이
          컴포넌트가 언마운트되지 않아 저장 알림 리전에 앞 명소 문구가 남는다.
          다시 낭독되지는 않지만 리전을 훑는 사용자에게는 지금 화면과 무관한
          말이 적혀 있게 된다. */}
      <AreaHero
        entry={entry}
        coords={location.coords}
        level={snapshot?.congestion}
        actions={
          <ActionButtons key={entry.name} entry={entry} />
        }
      />

      {/* **상세에서 가장 먼저, 가장 크게 나오는 값이다** — 샘플(서울
          인파레이더)의 「지금 약 40,000~42,000명」 자리. 칩보다 위인 것은
          샘플의 순서이고, 근거는 `PopulationLead`의 주석에 있다(예전에는 이
          자리에 배지와 같은 말인 「다소 혼잡」이 32px로 있었다).

          혼잡도 응답이 와야 생기므로 `snapshot`을 기다린다. 스켈레톤을 두지
          않는 이유는 아래 `query.isPending` 블록이 이미 그 일을 하기 때문이다 —
          같은 응답 하나를 기다리며 자리를 두 번 잡으면 도착할 때 두 번 덜컹인다. */}
      {snapshot !== undefined && (
        <PopulationLead snapshot={snapshot} pattern={pattern} />
      )}

      {/* 요약 칩 한 줄. 샘플(서울 인파레이더)의 「서행 · 행사 3 · 지하철 1 ·
          CCTV 5」 자리이고, 아래 절들의 목차 노릇도 한다 — 도시 정보가 통째로
          펼쳐지면서 상세가 매우 길어졌기 때문이다.

          **히어로 바로 다음, 혼잡도 앞이다.** 조작부가 제목 줄로 올라가면서
          샘플과 같은 자리가 됐다.

          추가 호출은 0이다. 이미 받아 둔 응답을 다시 셀 뿐이다. */}
      <div className="px-4">
        <CityInfoChips areaName={areaName} />
      </div>

      {query.isPending && (
        <div className="px-4">
          <SkeletonList count={3} />
        </div>
      )}

      {query.isError && (
        <div className="px-4">
          <ErrorState
            message={t("혼잡도 정보를 가져오지 못했어요.")}
            onRetry={() => void query.refetch()}
          />
        </div>
      )}

      {snapshot !== undefined && (
        <>
          {/* 패턴을 안 넘긴다. 「평소 대비」가 위 `PopulationLead`로 올라갔고
              이 카드에는 그 값을 쓰는 자리가 없다. */}
          <CongestionCard snapshot={snapshot} />

          <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            {/* "예측"은 시스템 용어에 가깝다. Google Maps의 「인기 시간대」 자리다.
                **「24시간 인파 흐름」이라고 쓰지 않는다** — 샘플(서울 인파레이더)의
                제목이지만 그쪽은 과거까지 그린다. 서울 API의 요청 인자에 날짜가
                없어 우리는 과거를 못 받고, 실데이터에서 예보는 12개다. */}
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-headline-sm text-on-surface">{t('시간대별 인파')}</h3>
              <span className="text-label-sm text-outline">{t('막대 = 예상 인원')}</span>
            </div>
            <div className="mt-3">
              <ForecastChart snapshot={snapshot} />
            </div>
          </section>

          {/* 시안(stitch_ui/_3)의 순서 그대로 시간축 바로 아래다. 예측이
              「오늘 앞으로」를 말하고 이 표가 「평소 이맘때」를 말한다. */}
          <WeeklyPatternCard pattern={pattern} now={new Date()} />
        </>
      )}

      {/* **도시 정보보다 앞이다.** 혼잡도 숫자를 보고 나서 가장 먼저 묻는 것이
          「그래서 지금 어떤데」이고, 영상이 그 질문에 유일하게 직접 답한다 —
          우리가 인파레이더와 갈리는 자리가 아니라 **맞추는** 자리다.

          `CityInfoPanel` 안이 아니라 밖인 이유는 조회가 다르기 때문이다. 저쪽은
          `citydata` 한 번이고 이쪽은 별개 엔드포인트다(쿼터도 안 쓴다). 안에
          두면 도시 정보가 통째로 없는 명소에서 조기 반환에 걸려 CCTV까지 함께
          사라진다. */}
      <CctvSection
        areaName={areaName}
        origin={{ lat: entry.lat, lng: entry.lng }}
        openStreamUrl={openCctvStreamUrl}
        onToggle={onToggleCctv}
      />

      {/* 기준점은 **명소 중심**이지 사용자 위치가 아니다. 상세는 지금 있는
          곳이 아니라 가려는 곳을 보는 화면이라, 부산에서 광화문을 열어도
          「120m」가 뜻을 가져야 한다 — 근거는 `facilityDistance.ts`. */}
      <CityInfoPanel
        areaName={areaName}
        origin={{ lat: entry.lat, lng: entry.lng }}
        onShowOnMap={onShowOnMap}
      />

      <NearbyCalmSection exclude={entry.name} onSelectArea={onSelectArea} />

      {/* **길찾기가 맨 아래다.** 샘플(서울 인파레이더)이 혼잡도·차트·CCTV·
          주차·행사를 다 보여준 뒤 맨 끝에 「카카오맵 / 네이버 / 티맵」을
          놓는다 — 화면의 순서가 곧 사용자의 순서라는 뜻이다. **읽고 나서
          갈지 정한다.** 근거는 `MapLinkButtons`의 주석. */}
      <MapLinkButtons entry={entry} />
    </div>
  )
}
