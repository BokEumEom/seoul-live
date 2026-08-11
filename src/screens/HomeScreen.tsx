import {
  AdvancedMarker,
  APIProvider,
  Map,
  type MapCameraChangedEvent,
} from '@vis.gl/react-google-maps'
import { useCallback, useMemo, useState } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AreaDetail } from '../components/home/AreaDetail'
import { BottomSheet } from '../components/home/BottomSheet'
import { FilterChips } from '../components/home/FilterChips'
import { SearchBar } from '../components/home/SearchBar'
import { SummaryStrip } from '../components/home/SummaryStrip'
import { AreaList } from '../components/list/AreaList'
import { AreaListItem } from '../components/list/AreaListItem'
import { CategoryFilter } from '../components/list/CategoryFilter'
import { LocationNotice } from '../components/list/LocationNotice'
import { SortSegmented } from '../components/list/SortSegmented'
import { CongestionMarker } from '../components/map/CongestionMarker'
import { MapUnavailableNotice } from '../components/map/MapUnavailableNotice'
import { RecenterButton } from '../components/map/RecenterButton'
import { AREA_CATALOG, AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import {
  DEFAULT_ZOOM,
  SEOUL_CENTER,
  shouldShowMarkerLabel,
  toMapMarkers,
} from '../domain/map'
import { filterAreas, filterCounts, filterLabel } from '../domain/presets'
import { searchAreas } from '../domain/search'
import type { Detent } from '../domain/sheet'
import { summarize } from '../domain/summary'
import type { Coords } from '../domain/types'
import { useCachedCityAlerts } from '../hooks/useCachedCityAlerts'
import { useFavorites } from '../hooks/useFavorites'
import { useHomeFilters } from '../hooks/useHomeFilters'
import { buildNearbyList } from '../hooks/useNearbyAreas'
import { TodayScreen } from './TodayScreen'
import {
  googleMapsApiKey,
  googleMapsMapId,
  isMapAvailable,
} from '../platform/googleMaps'

/** 재조정 버튼을 눌렀을 때의 줌. 주변 명소가 몇 곳 들어오는 정도다. */
const RECENTER_ZOOM = 14

// 상단바(3.5rem)와 하단 탭바(3.5rem), 안전 영역 여유를 뺀 높이.
//
// **Task 10까지의 임시 조치다.** 지도가 `absolute inset-0`이 되면서 이 화면은
// 부모가 정해 주는 높이를 그대로 쓰는 게 맞고(`size-full`), 계획서도 그렇게
// 적혀 있다. 그런데 지금 `App.tsx`는 이 화면을 `<div hidden={...}>`으로 감싸고
// 그 div에 높이를 주지 않는다 — `size-full`로 바꾸면 `height: 100%`가 auto인
// 부모를 만나 지도가 0px로 접힌다. 탭바를 걷어내는 Task 10에서 셸이 `h-dvh`가
// 될 때 이 상수를 지우고 `size-full`로 바꾼다.
//
// iOS 안전 영역을 포함한 실제 값은 실기기로만 확정된다 — STATE.md의 미해결 항목.
const HOME_HEIGHT_CLASS = 'h-[calc(100dvh-7.5rem)]'

interface Props {
  /**
   * 즐겨찾기·오늘의 서울 **탭**에서 명소를 눌러 홈으로 넘어올 때.
   *
   * Task 10에서 탭바와 함께 사라진다. 계획서는 이 태스크에서 지우라고 했지만
   * 지금 지우면 `App`이 그 이동을 표현할 수단을 통째로 잃는다 — 탭은 Task 10
   * 전까지 살아 있으므로 그동안 앱이 서 있으려면 이 통로도 있어야 한다.
   */
  readonly focusArea?: string | null
}

export function HomeScreen({ focusArea = null }: Props) {
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()
  const filters = useHomeFilters()
  // 즐겨찾기가 탭에서 필터 칩으로 옮겨 오면서 홈의 것이 됐다.
  const { favorites } = useFavorites()
  // 「오늘의 서울」이 시트 안 뷰가 되면서 요약 줄의 재난문자 개수도 여기서 센다.
  // 캐시에 있는 것만 읽으므로 추가 호출이 없다.
  const alerts = useCachedCityAlerts()

  // 초기 뷰는 위치 권한과 무관하게 서울 전역이다. 내 위치로 자동 이동하면
  // 서울 밖 사용자에게 마커가 하나도 없는 지도가 뜬다.
  const [center, setCenter] = useState<Coords>(SEOUL_CENTER)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [loadFailed, setLoadFailed] = useState(false)
  // 진입 시 half다. 앱인토스 심사 항목("진입하자마자 바텀시트가 자동으로
  // 나타나지 않아요")은 덮어씌우는 모달 시트를 말하는 것이라, 지도와 함께
  // 상시 보이는 이 셸의 기본 단계와는 다른 이야기다 — 그래도 full로는 열지 않는다.
  const [detent, setDetent] = useState<Detent>('half')
  const [view, setView] = useState<'list' | 'today'>('list')

  const { setSelectedName, setSort } = filters

  // 명소를 여는 유일한 경로다. 목록 행·지도 마커·「오늘의 서울」의 순위 목록,
  // 그리고 아래 focusArea 조정이 모두 여기로 들어온다 — 어디서 열든 시트가
  // 상세로 가득 차야 같은 화면이 된다.
  //
  // useCallback은 **성능 때문이 아니다.** 마커의 `onClick`은
  // `() => openArea(...)` 인라인 화살표라 이 함수가 안정적이든 아니든 매 렌더
  // 새것이고, 닿았더라도 소용이 없다 — vis.gl의 `useDomEventListener`가
  // 리스너를 다는 effect의 의존성이 `[target, name, isCallbackDefined]`라
  // **콜백 신원을 아예 보지 않는다**(node_modules에서 확인했다). 목록·상세·
  // 오늘의 서울도 `memo`가 아니다.
  //
  // 남는 이유는 하나다: 아래 focusArea 조정이 이 함수를 렌더 중에 부르므로
  // 매 렌더 새 함수면 그 자리에서 무엇이 바뀌었는지 읽기 어려워진다. 비용이
  // 0이라 그대로 둔다. 의존성 `setSelectedName`은 useHomeFilters가 돌려주는
  // useState 세터라 참조가 고정이다 — `filters` 객체 쪽은 매 렌더 새것이라
  // 넣으면 memo가 통째로 무의미해진다.
  const openArea = useCallback(
    (name: string): void => {
      setSelectedName(name)
      setView('list')
      setDetent('full')
    },
    [setSelectedName],
  )

  // focusArea가 바뀐 순간에만 그 명소를 연다. 즐겨찾기·오늘의 서울 **탭**에서
  // 넘어오는 통로이고 Task 10에서 탭바와 함께 사라진다.
  //
  // effect가 아니라 렌더 중 상태 조정이다. React가 「prop이 바뀔 때 상태
  // 맞추기」에 권하는 형태이고, effect로 쓰면 상세가 한 프레임 늦게 열려
  // 목록이 번쩍인다. 직전에 연 이름을 따로 들고 있어야 하는 이유는, 사용자가
  // 그 상세를 닫은 뒤에도 focusArea는 그대로라 매 렌더 다시 열리기 때문이다.
  const [openedFocus, setOpenedFocus] = useState<string | null>(null)
  if (focusArea !== null && focusArea !== openedFocus) {
    setOpenedFocus(focusArea)
    openArea(focusArea)
  }

  const list = useMemo(
    () =>
      buildNearbyList({
        entries: AREA_CATALOG,
        snapshots: snapshots.data ?? [],
        coords: location.coords,
        category: filters.category,
        sort: filters.sort,
      }),
    [snapshots.data, location.coords, filters.category, filters.sort],
  )

  // 개수는 걸러지기 전 목록으로 센다. 걸러진 목록으로 세면 칩 하나를 고르는
  // 순간 나머지 셋이 0이 되어 비활성으로 굳고, 다른 목적으로 갈아탈 방법이
  // 사라진다.
  //
  // 「내 장소」 개수를 favorites.length로 따로 세지 않는다. 그러면 카테고리로
  // 좁혔거나 카탈로그에서 이름이 바뀐 곳까지 세어 칩의 숫자와 목록이 갈린다.
  // filterCounts는 filterAreas를 그대로 부른다.
  //
  // list와 같이 memo한다. 지도를 팬할 때마다 onCameraChanged가 center·zoom을
  // 바꿔 이 화면이 다시 그려지는데, 그때마다 30곳을 네 번 훑을 이유가 없다.
  // favorites는 스토어의 배열을 그대로 받으므로 참조가 안정적이다.
  const counts = useMemo(() => filterCounts(list, favorites), [list, favorites])
  const visible = useMemo(
    () => searchAreas(filterAreas(list, filters.filter, favorites), filters.query),
    [list, filters.filter, filters.query, favorites],
  )

  // 로딩 중에는 마커를 세우지 않는다. 스냅샷이 없는 명소는 회색 "정보 없음"으로
  // 그려지는데, 아직 안 온 것과 없는 것은 사용자에게 다른 말이다.
  //
  // memo하는 이유가 `visible`·`counts`와 같다. vis.gl의 `usePropBinding`이
  // `useEffect(..., [object, prop, value])`로 `marker.position = value`를 거는데,
  // 매 렌더 새 배열이면 그 안의 `position`도 새 객체라 지도를 팬할 때마다
  // 마커 30개에 대입이 나간다. 팬 중에는 카메라 이벤트가 연속으로 들어온다.
  const markers = useMemo(
    () => (snapshots.isPending ? [] : toMapMarkers(visible)),
    [snapshots.isPending, visible],
  )
  const showLabel = shouldShowMarkerLabel(zoom)
  const mapReady = isMapAvailable() && !loadFailed

  // 키가 없으면 시트를 half에 묶는다. 지도 안내가 화면의 92%를 차지할 이유가
  // 없고, 접을 수 있게 두면 안내가 사라져 더 헷갈린다. 파생 변수로 한 번만
  // 정하는 이유는 아래 오버레이 규칙이 같은 값을 봐야 해서다 — 두 곳에서
  // 따로 `mapReady ? detent : 'half'`를 쓰면 한쪽만 고쳐지는 날이 온다.
  const sheetDetent: Detent = mapReady ? detent : 'half'

  function handleCameraChanged(event: MapCameraChangedEvent): void {
    setCenter(event.detail.center)
    setZoom(event.detail.zoom)
  }

  // 검색 줄에 있던 「내 주변」을 흡수했다. 지도를 내 위치로 옮기고 목록을
  // 거리순으로 바꾼 뒤 시트를 내린다 — 옮긴 지도를 시트가 덮고 있으면
  // 옮긴 보람이 없다.
  function handleRecenter(): void {
    if (location.coords === null) return
    setCenter(location.coords)
    setZoom(RECENTER_ZOOM)
    setSort('distance')
    setDetent('peek')
  }

  const mapPane = !isMapAvailable() ? (
    <MapUnavailableNotice reason="no-key" />
  ) : loadFailed ? (
    // 스크립트를 못 받은 경우다(오프라인·차단·잘못된 키). 키 미설정과 문구를
    // 나눠야 개발자와 사용자가 각각 맞는 곳을 의심한다.
    <MapUnavailableNotice reason="load-failed" />
  ) : (
    <APIProvider
      apiKey={googleMapsApiKey()}
      onError={(error) => {
        console.error('지도 스크립트를 불러오지 못했습니다:', error)
        setLoadFailed(true)
      }}
    >
      <Map
        mapId={googleMapsMapId()}
        center={center}
        zoom={zoom}
        onCameraChanged={handleCameraChanged}
        reuseMaps
        // 지도는 심사 체크리스트가 제스처 확대·축소를 명시적으로 허용하는 용례다.
        gestureHandling="greedy"
        disableDefaultUI
        className="size-full"
      >
        {location.coords !== null && (
          <AdvancedMarker position={location.coords}>
            {/* disableDefaultUI라 JS API의 기본 파란 점이 없다. */}
            <span
              role="img"
              aria-label="현재 위치"
              className="block size-4 rounded-full border-2 border-white bg-primary shadow-floating"
            />
          </AdvancedMarker>
        )}

        {markers.map((marker) => (
          <AdvancedMarker
            key={marker.entry.code}
            // `toMapMarkers`가 만들어 둔 객체를 그대로 넘긴다. 여기서
            // `{{ lat, lng }}`로 새로 만들면 위 memo가 통째로 무의미해진다.
            position={marker.position}
            onClick={() => openArea(marker.entry.name)}
          >
            <CongestionMarker
              name={marker.entry.name}
              level={marker.level}
              showLabel={showLabel}
              selected={marker.entry.name === filters.selectedName}
            />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  )

  // 빈 목록이 무엇 때문인지 말한다. 검색어가 있으면 검색어를 지목한다 —
  // 지우는 버튼이 검색 바에 이미 있어 풀 길이 함께 있고, 두 원인을 한 문장에
  // 담으면 길어진다. 검색어를 지우면 필터만 걸린 상태로 돌아가 그때 필터
  // 문구가 뜬다.
  //
  // 카테고리도 0의 원인일 수 있지만 지목하지 않는다. 카테고리는 언제나 화면에
  // 보이는 탭 줄이라 무엇이 골라져 있는지 눈에 있고, 칩과 달리 「전체」로
  // 돌아가는 자리가 그 줄 안에 이미 있다. 칩은 스스로 0이 되면 비활성으로
  // 굳을 수 있어 끄는 버튼이 따로 필요했다.
  const clearableFilter = filters.query === '' ? filters.filter : null
  const emptyMessage =
    filters.query !== ''
      ? `「${filters.query}」에 해당하는 명소가 없어요.`
      : clearableFilter !== null
        ? `「${filterLabel(clearableFilter)}」에 해당하는 명소가 없어요.`
        : '조건에 맞는 명소가 없어요.'

  const listPane = (
    <div className="flex flex-col gap-3 pb-6">
      {/* 조회가 영구 실패하면 그리지 않는다. 스트립의 빈 상태 문구는
          「아직 받지 못했어요」라 로딩을 뜻하는데, 바로 아래 ErrorState는
          「가져오지 못했어요」라고 말한다 — 같은 자리에서 두 문장이 어긋난다.
          CitySummary에 실패를 표현할 수단이 없어 스트립 혼자서는 못 고친다. */}
      {!snapshots.isError && (
        <div className="px-4">
          <SummaryStrip
            summary={summarize(list)}
            alertCount={alerts.length}
            onOpen={() => {
              setView('today')
              setDetent('full')
            }}
          />
        </div>
      )}

      <LocationNotice status={location.status} onRetry={location.retry} />

      <CategoryFilter value={filters.category} onChange={filters.setCategory} />

      <div className="px-4">
        <SortSegmented
          value={filters.sort}
          canSortByDistance={location.coords !== null}
          onChange={setSort}
        />
      </div>

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

      {/* 실패했을 때는 빈 목록 문구를 얹지 않는다. ErrorState가 이미 무슨 일이
          났는지 말했고, 그 아래 "조건에 맞는 명소가 없어요"가 붙으면 원인을
          조건 탓으로 돌리게 된다. */}
      {!snapshots.isPending && !snapshots.isError && visible.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-body-md text-on-surface-variant">{emptyMessage}</p>
          {clearableFilter !== null && (
            <button
              type="button"
              onClick={() => filters.setFilter(null)}
              className="mt-3 min-h-12 rounded-full bg-secondary-container px-4 text-label-md font-semibold text-primary"
            >
              필터 해제
            </button>
          )}
        </div>
      )}

      <div className="px-4">
        <AreaList>
          {visible.map((area) => (
            <AreaListItem
              key={area.entry.code}
              area={area}
              favorite={favorites.includes(area.entry.name)}
              onSelect={openArea}
            />
          ))}
        </AreaList>
      </div>
    </div>
  )

  // 시트 내용은 셋 중 하나다. 선택된 명소가 「오늘의 서울」보다 앞선다 —
  // 오늘의 서울에서 명소를 누르면 그 상세로 가야 하기 때문이다.
  const sheetContent =
    filters.selectedName !== null ? (
      <AreaDetail
        areaName={filters.selectedName}
        onBack={() => {
          setSelectedName(null)
          setDetent('half')
        }}
        onSelectArea={openArea}
      />
    ) : view === 'today' ? (
      <TodayScreen
        onSelectArea={openArea}
        onBack={() => {
          setView('list')
          setDetent('half')
        }}
      />
    ) : (
      listPane
    )

  return (
    <div className={`relative w-full overflow-hidden ${HOME_HEIGHT_CLASS}`}>
      {/* 지도가 뷰포트를 꽉 채우고 시트가 그 위를 덮는다. 공간을 나눠 갖지
          않으므로 상세를 열어도 지도는 뒤에서 온전한 크기로 살아 있다.

          `data-map-layer`는 테스트 손잡이다. 「지도가 시트 **뒤에** 전체
          크기로 깔린다」는 것은 지도가 어느 레이어에 속하는지로만 확인되는데,
          jsdom에는 레이아웃이 없어 위치로는 못 잡는다. 마커를 목록 행과
          구별해 집는 데도 이 표식을 쓴다. */}
      <div data-map-layer className="absolute inset-0">
        {mapPane}
      </div>

      {/* **전체로 펼치면 지도 위 조작부가 통째로 물러난다.** 이유가 조작부마다
          다르지만 결론이 같아서 한 조건으로 묶었다.

          검색 바 + 칩 열: 800px 기준 full(92%)의 시트 상단이 64px이고 손잡이
          히트 영역이 44~88px인데 이 열이 0~88px을 덮는다. 둘 다
          `pointer-events-auto`이고 폭이 화면 전체라 손잡이를 **통째로** 가려
          full에서는 시트를 잡을 수가 없다.

          FAB: full에서는 48px가 들어갈 자리가 아예 없다 — 버튼 몫이 `0.06H`라
          `H ≥ 800px`이라야 안 잘리는데 컨테이너는 `100dvh − 7.5rem`이다.
          자세한 산식은 `RecenterButton`에 있다.

          `opacity-0`이 아니라 조건부 렌더다. 그래야 포인터 이벤트와 접근성
          트리가 함께 정리되고, 사라졌다는 사실을 테스트로 잠글 수 있다.

          `showSearchOverlay` 같은 파생 불리언을 쓰지 않고 여기서 직접 비교하는
          이유는 **타입 좁히기** 때문이다. 이 비교라야 `sheetDetent`가
          `RecenterDetent`로 좁혀져, full에 설 자리가 없다는 불변식을 컴파일러가
          지킨다. 불리언으로 감싸면 그 검사가 사라진다.

          되돌아올 길은 막히지 않는다: 「목록으로」가 half로 내리고, 손잡이를
          누르면 full→peek으로 굴러간다. 키가 없어 half에 묶인 경우에는 계속
          보인다 — 지도가 죽었을 때 검색은 유일하게 남은 길이라 닫으면 안 된다. */}
      {sheetDetent !== 'full' && (
        <>
          <div
            // `data-overlay`도 테스트 손잡이다. 검색 바가 **지도 위에 떠 있다**는
            // 것은 어느 컨테이너에 속하는지로만 확인된다 — 시트 안으로
            // 옮겨져도 `getByRole('searchbox')`는 그대로 찾아내기 때문이다.
            data-overlay
            // 컨테이너는 이벤트를 통과시킨다. 칩 줄과 검색 바 사이의 빈 곳에서
            // 지도를 끌 수 있어야 한다 — 되살리는 것은 자식 쪽이다.
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1"
          >
            <div className="pointer-events-auto">
              <SearchBar value={filters.query} onChange={filters.setQuery} />
            </div>
            <FilterChips
              counts={counts}
              value={filters.filter}
              onChange={filters.setFilter}
            />
          </div>

          <RecenterButton
            disabled={location.coords === null}
            detent={sheetDetent}
            onClick={handleRecenter}
          />
        </>
      )}

      <BottomSheet
        detent={sheetDetent}
        onDetentChange={mapReady ? setDetent : () => {}}
      >
        {sheetContent}
      </BottomSheet>
    </div>
  )
}
