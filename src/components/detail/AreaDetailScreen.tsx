import { m } from 'framer-motion'
import { useState } from 'react'
import { t } from '../../i18n/t'
import { useLocation } from '../../app/locationContext'
import { MotionProvider } from '../../app/MotionProvider'
import { findAreaByName } from '../../data/areas'
import { useAreaSnapshot } from '../../data/queries'
import type { FacilityLocation } from '../../domain/cityInfo'
import {
  detailTabButtonId,
  detailTabIndex,
  detailTabPanelId,
  type DetailTabId,
} from '../../domain/detailTabs'
import { useWeekPattern } from '../../hooks/useWeekPattern'
import { ActionButtons } from '../home/ActionButtons'
import { MapLinkButtons } from '../home/MapLinkButtons'
import { DetailAppBar } from './DetailAppBar'
import { DetailHero } from './DetailHero'
import { DetailTabs } from './DetailTabs'
import { EventsPanel } from './panels/EventsPanel'
import { NearbyPanel } from './panels/NearbyPanel'
import { PopulationPanel } from './panels/PopulationPanel'
import { SafetyPanel } from './panels/SafetyPanel'
import { SummaryPanel } from './panels/SummaryPanel'
import { TrafficPanel } from './panels/TrafficPanel'
import { WeatherPanel } from './panels/WeatherPanel'

interface Props {
  readonly areaName: string
  readonly onBack: () => void
  /** 「근처 쾌적한 장소」에서 다른 명소로 갈아탈 때. */
  readonly onSelectArea: (name: string) => void
  /** 주차장·따릉이 줄의 아이콘이 누르는 것. 지도는 `HomeScreen`이 갖는다. */
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 명소 상세 — **시트 안의 한 뷰 + 탭.**
 *
 * **전체 화면이었다가 되돌아왔다**(2026-08-21, 사용자 결정). 전체 화면으로 뺀
 * 이유는 길이였다 — 도시 정보를 상시 펼침으로 바꾸며 한 장이 **5,395px**까지
 * 자랐고(2026-08-20 실측, 390×844) 주 조작인 길찾기가 화면 열두 개 아래였다.
 *
 * **그 이유는 이제 없다.** 같은 회차에 탭 일곱으로 갈랐고, 길이를 만든 것은
 * 시트가 아니라 「한 장에 전부」였다. 탭이 그것을 풀었으므로 시트로 돌아와도
 * 5,395px은 되살아나지 않는다 — 지금 가장 긴 패널도 한 화면 남짓이다.
 *
 * 되돌려서 얻는 것은 **지도가 살아 있는 것**이다. 전체 화면은 지도를 통째로
 * 덮어서, 「어디쯤인가」를 보려면 뒤로 나갔다 다시 들어와야 했다. 이 앱에서
 * 혼잡도는 언제나 **장소에 붙은 값**이라 지도가 곧 맥락이다.
 *
 * **스크롤 상자를 갖지 않는다.** 시트(`data-sheet-content`)가 이미 스크롤
 * 컨테이너다. 여기서 하나 더 만들면 상자가 둘이 되어 시트의 드래그·스크롤
 * 되돌리기가 안쪽 상자를 못 본다. 상단 바와 탭 줄은 `sticky`로 그 상자에
 * 붙는다.
 */
export function AreaDetailScreen({
  areaName,
  onBack,
  onSelectArea,
  onShowOnMap,
}: Props) {
  const entry = findAreaByName(areaName)

  // 카탈로그에 없는 이름은 조회하지 않는다. 프록시의 허용 목록에 걸려 400이
  // 오고 그 실패가 캐시될 뿐이다.
  const query = useAreaSnapshot(entry === undefined ? undefined : areaName)
  const location = useLocation()
  const snapshot = query.data

  // 상세를 열 때마다 이 명소의 지금 혼잡도를 한 칸 쌓는다. 서울 API가 과거를
  // 주지 않아 패턴을 조회할 수 없고, 쌓는 것 말고 방법이 없다 — PLAN.md 4차.
  const pattern = useWeekPattern(entry?.name, snapshot)

  // **명소를 갈아타면 요약으로 돌아간다.** `HomeScreen`이 이 컴포넌트에
  // 명소 이름을 `key`로 주므로 상태가 통째로 새로 만들어진다 — 여기서
  // effect로 되돌리지 않는 이유가 그것이다. effect로 하면 한 프레임 동안
  // 앞 명소의 탭이 새 명소의 데이터로 그려진다.
  const [tab, setTabId] = useState<DetailTabId>('summary')

  /**
   * 마지막 탭 이동이 오른쪽(`1`)이었나 왼쪽(`-1`)이었나. 패널이 어느 쪽에서
   * 밀려 들어올지를 정한다.
   *
   * **렌더 중에 파생할 수 없다.** 지금 탭만 봐서는 어디서 왔는지 알 수 없고,
   * 이전 값을 ref로 들면 같은 탭을 두 번 눌렀을 때(방향 0) 애매해진다.
   * 바꾸는 순간에 함께 정하는 편이 상태가 하나 더 느는 대신 읽기 쉽다.
   */
  const [direction, setDirection] = useState(1)

  function setTab(next: DetailTabId): void {
    setDirection(detailTabIndex(next) >= detailTabIndex(tab) ? 1 : -1)
    setTabId(next)
  }

  /**
   * 지금 펼쳐 둔 CCTV의 스트림 주소.
   *
   * **예전에는 `HomeScreen`이 들고 있었다.** 지도의 CCTV 마커와 시트의 목록이
   * 같은 선택을 보는 두 창이었기 때문이다. 상세가 전체 화면이 되면서 지도 쪽
   * 창이 사라졌고(그 층은 상세가 열려 있을 때만 그려지는데 그때 지도가 덮인다),
   * 남은 하나가 여기다. 명소를 갈아타면 이 컴포넌트가 통째로 새로 만들어지므로
   * **앞 명소의 영상이 계속 흐르는 일**도 저절로 막힌다.
   */
  const [openCctv, setOpenCctv] = useState<string | null>(null)

  // **포커스는 이 화면이 가져가지 않는다.** 시트 안으로 돌아오면서 시트의
  // 받침대(`HomeScreen`의 `viewRef`)가 다시 그 일을 한다 — 뷰가 목록·상세·
  // 오늘의 서울 중 무엇으로 갈리든 같은 상자가 받아야 「포커스를 옮긴 뒤 그
  // 요소가 사라지면?」이 표현 불가능해진다. 전체 화면 시절에는 시트가 `inert`라
  // 그 길이 막혀 여기서 직접 받았다.

  if (entry === undefined) {
    return (
      <div className="flex flex-col bg-surface">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            className="min-h-12 px-4 text-label-md font-semibold text-primary"
          >
            {t('뒤로')}
          </button>
        </header>
        <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
          {t('명소를 찾을 수 없어요.')}
        </p>
      </div>
    )
  }

  return (
    // 위 「못 찾음」 갈래는 `m.*`를 안 쓰므로 감싸지 않는다. 근거는
    // `app/MotionProvider.tsx` — 이 화면이 혼자 렌더돼도 탭 패널이
    // `initial`(opacity 0)에 얼어붙지 않게 하려는 것이다.
    <MotionProvider>
      <div className="flex flex-col bg-surface">
        <DetailAppBar
          entry={entry}
          onBack={onBack}
          // key를 명소 이름으로 두는 이유: 「근처 쾌적한 장소」로 갈아타면 저장
          // 알림 리전에 앞 명소 문구가 남는다. 다시 낭독되지는 않지만 리전을
          // 훑는 사용자에게는 지금 화면과 무관한 말이 적혀 있게 된다.
          actions={<ActionButtons key={entry.name} entry={entry} />}
        />

        {/* **스크롤 상자를 여기서 만들지 않는다.** 시트가 이미 하나이고
            (`data-sheet-content`), 안에 하나 더 두면 시트의 「뷰를 갈아 끼울 때
            scrollTop을 0으로」가 바깥 상자만 되돌려 상세가 앞 뷰의 스크롤 자리에서
            시작한다.

            그래서 앱 바와 탭 줄이 **한 상자에서 함께 sticky**다. 예전에 이 조합을
            피했던 이유는 앱 바 높이가 `pt-safe` 때문에 기기마다 달라서였는데,
            시트 안에서는 그 패딩이 없다 — 이 바는 화면 맨 위가 아니라 손잡이
            아래다. 높이가 48px(`size-12`)로 고정이라 탭 줄의 `top-12`가 성립한다.

            **아래 패딩을 두지 않는다.** sticky가 붙는 자리는 스크롤 상자의 패딩
            안쪽이라, `pb-6`을 주면 길찾기 바가 시트 밑변에서 24px 떠 있다
            (390×844 실측으로 확인했다). */}
        <DetailHero entry={entry} coords={location.coords} snapshot={snapshot} />

        <DetailTabs value={tab} onChange={setTab} />

        {/* `tabIndex={0}`은 WAI-ARIA 탭 규약이다 — 패널 안에 초점 받을 것이
            하나도 없는 탭(빈 상태 한 줄)에서도 키보드 사용자가 내용을 읽을 수
            있어야 한다.

            **`key={tab}`이 전환 애니메이션의 전부다.** 키가 바뀌면 React가 앞
            패널을 버리고 새것을 마운트하므로, 새것의 `initial`부터 `animate`로
            가는 길이 곧 「들어오는 동작」이 된다.

            **`AnimatePresence`를 쓰지 않았다.** 나가는 애니메이션까지 넣으려면
            앞 패널이 다 사라질 때까지 새 패널이 기다려야 하는데(`mode="wait"`),
            탭은 페이지 이동과 달리 **같은 화면 안에서 내용만 갈리는 조작**이라
            그 기다림이 그대로 지연으로 읽힌다. 게다가 언마운트가 비동기가 되어
            「탭을 누르면 그 내용이 보인다」는 테스트가 전부 `waitFor`를 달아야
            한다 — 값에 비해 치르는 것이 크다.

            거리가 12px인 것은 **방향만 읽히면 충분**해서다. 그 이상은 글자가
            실제로 흐르는 것처럼 보여 읽던 자리를 놓친다. `prefers-reduced-motion`
            에서는 x가 꺼지고 페이드만 남는다(`MotionProvider`).

            `role`·`id`·`aria-*`는 그대로다 — 애니메이션 상자를 따로 두면 패널의
            정체가 한 겹 안으로 밀려 `aria-controls`가 빈 상자를 가리킨다. */}
        <m.div
          key={tab}
          id={detailTabPanelId(tab)}
          role="tabpanel"
          aria-labelledby={detailTabButtonId(tab)}
          tabIndex={0}
          initial={{ opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="py-4"
        >
          {tab === 'summary' && (
            <SummaryPanel
              entry={entry}
              snapshot={snapshot}
              congestionFailed={query.isError}
              onRetryCongestion={() => void query.refetch()}
              onOpenTab={setTab}
              onSelectArea={onSelectArea}
              openCctvStreamUrl={openCctv}
              onToggleCctv={(streamUrl) => {
                // 같은 줄을 다시 누르면 접는다.
                setOpenCctv((current) => (current === streamUrl ? null : streamUrl))
              }}
            />
          )}

          {/* 혼잡도가 없으면 인구 탭에 그릴 것이 없다. 요약 탭이 이미 실패를
              말하고 다시 시도할 길을 주므로 여기서 한 번 더 적지 않는다. */}
          {tab === 'population' &&
            (snapshot === undefined ? (
              <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
                {t('혼잡도 정보를 아직 받지 못했어요.')}
              </p>
            ) : (
              <PopulationPanel
                snapshot={snapshot}
                pattern={pattern}
                now={new Date()}
              />
            ))}

          {tab === 'traffic' && <TrafficPanel areaName={areaName} />}

          {/* 기준점은 **명소 중심**이지 사용자 위치가 아니다. 상세는 지금 있는
              곳이 아니라 가려는 곳을 보는 화면이라, 부산에서 광화문을 열어도
              「120m」가 뜻을 가져야 한다 — 근거는 `facilityDistance.ts`. */}
          {tab === 'nearby' && (
            <NearbyPanel
              areaName={areaName}
              origin={{ lat: entry.lat, lng: entry.lng }}
              onShowOnMap={onShowOnMap}
            />
          )}

          {tab === 'weather' && <WeatherPanel areaName={areaName} />}
          {tab === 'events' && <EventsPanel areaName={areaName} />}
          {tab === 'safety' && <SafetyPanel areaName={areaName} />}
        </m.div>

        {/* **길찾기는 탭 밖이다.** 어느 탭에 있든 「그래서 갈까」는 같은
            질문이라, 요약에만 두면 날씨를 보다 가기로 마음먹은 사용자가
            탭을 되돌아가야 한다. */}
        <MapLinkButtons entry={entry} />
      </div>
    </MotionProvider>
  )
}
