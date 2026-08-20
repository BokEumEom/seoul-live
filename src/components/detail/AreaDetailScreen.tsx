import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/t'
import { useLocation } from '../../app/locationContext'
import { findAreaByName } from '../../data/areas'
import { useAreaSnapshot } from '../../data/queries'
import type { FacilityLocation } from '../../domain/cityInfo'
import {
  detailTabButtonId,
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
 * 명소 상세 — **전체 화면 + 탭.**
 *
 * **예전에는 하단 시트 안의 한 뷰였다.** 도시 정보를 접이식에서 상시 펼침으로
 * 바꾸면서 한 장의 길이가 **5,395px**까지 자랐고(2026-08-20 실측, 390×844),
 * 주 조작인 길찾기가 화면 열두 개 아래에 있었다. 시트 안에서는 그 길이를 줄일
 * 방법이 없다 — 지도를 위에 남겨 두느라 세로의 절반을 이미 내줬기 때문이다.
 *
 * 전체 화면으로 나오면서 둘을 얻는다. 하나는 **높이 전부**이고, 다른 하나는
 * **탭으로 가를 명분**이다. 「탭 한 번 뒤에 감추지 않는다」던 예전 판단은
 * 여전히 지켜진다 — 요약 탭의 카드 여덟 칸이 값까지 보여주고, 자세히 볼
 * 사람만 넘긴다(`SummaryGrid`).
 *
 * **지도는 뒤에 그대로 살아 있다.** `HomeScreen`이 이 화면을 지도 위 층으로
 * 얹으므로 뒤로가기가 즉시이고, 주차장 「지도에서 보기」도 그대로 동작한다.
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
  const [tab, setTab] = useState<DetailTabId>('summary')

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

  /**
   * **이 화면이 열리면 포커스가 여기로 온다.**
   *
   * 예전에는 시트가 포커스를 받았다(`HomeScreen`의 `requestSheetFocus`).
   * 상세가 전체 화면 층으로 나가면서 시트는 뒤에서 `inert`가 되므로 그 길이
   * 막혔고, 그대로 두면 명소를 여는 순간 포커스가 `document.body`로 떨어진다 —
   * body에서 누른 Tab은 문서 맨 앞부터 다시 세는데, 상세 앞에는 지도 레이어가
   * 통째로 놓여 있다(지금은 inert라 건너뛰지만 순서를 다시 세는 것은 같다).
   *
   * 마운트 때 한 번만 돈다. `HomeScreen`이 명소 이름을 `key`로 주므로 명소를
   * 갈아타면 새 마운트가 되고, 그래서 「갈아탈 때도 포커스가 따라온다」가
   * 의존성 배열 없이 성립한다.
   */
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  if (entry === undefined) {
    return (
      <div ref={rootRef} tabIndex={-1} className="flex size-full flex-col bg-surface">
        <header className="flex items-center gap-1 pt-safe">
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

  // `tabIndex={-1}`은 포커스 받침대다 — 탭 순서에는 안 들어가고 위 effect가
  // 프로그램으로만 포커스를 준다. 이름을 안 주는 이유는 `HomeScreen`의 시트
  // 받침대와 같다: `generic` role에는 이름을 못 붙이고, 이 화면의 정체는 바로
  // 아래 상단 바의 제목이 이미 말한다.
  return (
    <div ref={rootRef} tabIndex={-1} className="flex size-full flex-col bg-surface">
      <DetailAppBar
        entry={entry}
        onBack={onBack}
        // key를 명소 이름으로 두는 이유: 「근처 쾌적한 장소」로 갈아타면 저장
        // 알림 리전에 앞 명소 문구가 남는다. 다시 낭독되지는 않지만 리전을
        // 훑는 사용자에게는 지금 화면과 무관한 말이 적혀 있게 된다.
        actions={<ActionButtons key={entry.name} entry={entry} />}
      />

      {/* **스크롤 상자가 앱 바 아래에서 시작한다.** 그래야 탭 줄의 `sticky
          top-0`이 앱 바에 정확히 붙는다 — 한 상자에서 둘 다 sticky로 쌓으면
          앱 바 높이를 탭 줄의 `top`에 적어야 하고, 그 숫자는 안전영역 때문에
          기기마다 다르다.

          **아래 패딩을 두지 않는다.** sticky가 붙는 자리는 이 상자의 패딩
          안쪽이라, `pb-6`을 주면 길찾기 바가 화면 밑변에서 24px 떠 있다
          (390×844 실측으로 확인했다). 바가 흐름의 마지막 요소라 제 자리를
          남기므로 아래 여백은 따로 필요하지 않다. */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <DetailHero entry={entry} coords={location.coords} snapshot={snapshot} />

        <DetailTabs value={tab} onChange={setTab} />

        {/* `tabIndex={0}`은 WAI-ARIA 탭 규약이다 — 패널 안에 초점 받을 것이
            하나도 없는 탭(빈 상태 한 줄)에서도 키보드 사용자가 내용을 읽을 수
            있어야 한다. */}
        <div
          id={detailTabPanelId(tab)}
          role="tabpanel"
          aria-labelledby={detailTabButtonId(tab)}
          tabIndex={0}
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
        </div>

        {/* **길찾기는 탭 밖이다.** 어느 탭에 있든 「그래서 갈까」는 같은
            질문이라, 요약에만 두면 날씨를 보다 가기로 마음먹은 사용자가
            탭을 되돌아가야 한다. */}
        <MapLinkButtons entry={entry} />
      </div>
    </div>
  )
}
