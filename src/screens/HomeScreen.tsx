import {
  AdvancedMarker,
  APIProvider,
  Map,
  type MapCameraChangedEvent,
} from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonRows } from '../components/common/SkeletonCard'
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
import {
  MapUnavailableNotice,
  type MapUnavailableReason,
} from '../components/map/MapUnavailableNotice'
import { RecenterButton } from '../components/map/RecenterButton'
import { AREA_CATALOG, AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import {
  DEFAULT_ZOOM,
  markerZIndex,
  SEOUL_CENTER,
  shouldShowMarkerLabel,
  toMapMarkers,
} from '../domain/map'
import {
  filterAreas,
  filterCounts,
  filterLabel,
  type FilterKey,
} from '../domain/presets'
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

export function HomeScreen() {
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

  // 뷰가 갈리면 방금 누른 버튼이 언마운트되면서 포커스가 `document.body`로
  // 떨어진다. body에서 누른 Tab은 문서 맨 앞부터 다시 세는데, 시트 앞에는
  // 지도 레이어가 통째로 놓여 있다(`data-map-layer`가 형제 중 첫째다).
  // 키보드·스위치 사용자는 뷰를 바꿀 때마다 시트까지 다시 탭해 내려와야 한다.
  //
  // **「뷰가 달라졌는가」로는 판단할 수 없다.** 검색어를 치면 `setQuery`가
  // 선택을 풀어(`useHomeFilters`) 상세→목록 전환이 일어나는데, 그 전환은
  // 사용자가 시트로 가려던 조작이 아니라 **타이핑의 부수 효과**다. 거기서
  // 포커스를 가져가면 첫 글자만 입력되고 둘째 글자부터 사라진다(실제로 그랬다).
  // 칩을 눌러 선택이 풀릴 때도 마찬가지로 손이 칩 줄에 있다.
  //
  // 그래서 상태를 비교하는 대신 **옮겨 달라고 말한 조작만** 옮긴다.
  //
  // `document.activeElement`가 입력인지 보고 건너뛰는 길도 있었다. 타이핑은
  // 그것으로도 고쳐지지만 **칩 경로는 못 고친다** — 칩은 입력이 아니라서
  // 포커스를 그대로 뺏긴다. 원인이 아니라 증상을 보기 때문이다.
  // (한때 「마커로 상세를 열 때 포커스가 검색창에 남아 있으면 처방이
  // 건너뛰어진다」도 근거로 적었고, 그때는 `openArea`의 `setDetent('full')`이
  // 같은 커밋에서 검색 바를 언마운트해 그 상태가 **표현 불가능**했다.
  // **상세가 half에서 열리게 된 지금은 검색 바가 살아남아 표현 가능하다** —
  // 탐침으로 확인했다: 검색창에 포커스를 두고 `fireEvent.click`(포커스를 안
  // 옮긴다)으로 마커를 누르면 검색 바가 그대로인 채 포커스가 시트로 간다.
  // 그래도 결론은 안 바뀐다. 실제 조작은 포인터든 키보드든 **마커·행을 먼저
  // 활성화**하므로 그 시점의 `activeElement`는 이미 그 버튼이고, 설령 닿더라도
  // 「행을 눌렀다」는 사용자가 시트로 가겠다고 말한 것이라 옮기는 편이 옳다.)
  //
  const viewRef = useRef<HTMLDivElement>(null)
  // **ref가 아니라 상태다.** ref로 들면 「요청했는데 렌더가 안 일어나는」 경우에
  // 신호가 굳어 있다가 **나중에 엉뚱한 렌더에서 터진다.** 실제로 그랬다: 상세를
  // 연 뒤 시트 위로 남은 지도 조각에서 **같은 마커**를 다시 누르면 세 setter가
  // 전부 같은 값이라 React가 렌더를 건너뛰는데, 신호만 세워져 있다가 그다음
  // 아무 렌더(지도 팬·시트 조작·창 복귀 refetch)에서 포커스를 훔쳤다.
  //
  // 카운터인 이유는 **불리언이면 같은 병을 앓기 때문**이다 — 이미 참인데 참을
  // 넣으면 React가 또 건너뛴다. 증가값은 언제나 새 값이라 「요청했으면 반드시
  // 한 번 돈다」가 보장된다. 0은 「아직 아무도 요청하지 않았다」이고, 첫 렌더
  // 침묵이 거기서 공짜로 나온다.
  const [focusRequest, setFocusRequest] = useState(0)

  /** 시트 내용을 바꾸는 조작이 「포커스도 따라와라」를 말하는 유일한 통로다. */
  function requestSheetFocus(): void {
    setFocusRequest((count) => count + 1)
  }

  useEffect(() => {
    if (focusRequest === 0) return

    // **스크롤도 함께 되돌린다.** 목록·상세·오늘의 서울이 시트의 스크롤
    // 컨테이너 **하나를 나눠 쓰는데** 뷰가 갈려도 `scrollTop`은 그대로라,
    // 앞 뷰에서 내려둔 자리에서 새 뷰가 시작한다. 실측(390×844): 목록을 200
    // 내리고 명소를 열면 상세의 「목록으로」가 `top −47.5`로 화면 밖이고 맨 위에
    // 액션 행이 보인다. 상세에서 돌아오면 요약 스트립이 시트 위로 잘려 —
    // 「오늘의 서울」로 가는 **유일한 통로**가 사라진 것처럼 보인다.
    //
    // 컨테이너를 `parentElement`로 집지 않는다. 사이에 상자가 하나만 끼어도
    // 조용히 엉뚱한 요소를 만지고, jsdom에는 레이아웃이 없어 그 회귀를 잡을
    // 길이 없다 — Task 9에서 `.parentElement`로 같은 함정을 밟은 적이 있다.
    // `data-sheet-content`는 그래서 테스트 손잡이가 아니라 **런타임 계약**이다.
    const scroller = viewRef.current?.closest('[data-sheet-content]')
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 0
    }

    // 스크롤을 우리가 정한 뒤에 포커스를 준다. `preventScroll`은 브라우저가
    // 그 위에 제 스크롤을 얹지 않게 하는 것이다 — 방금 0으로 맞춘 자리를
    // 되돌리면 위 처방이 무의미해진다.
    //
    // (예전 주석은 「이 옵션이 없으면 시트가 튄다」고 적었는데 **거짓이었다.**
    // 실측: `scrollTop=200`에서 옵션 유무와 무관하게 200 그대로다. 포커스
    // 대상이 스크롤 컨테이너의 첫 자식이라 브라우저가 끌어올 것이 애초에 없다.
    // 옵션은 무해하고, 위 대입이 생긴 지금에야 진짜 이유가 붙었다.)
    viewRef.current?.focus({ preventScroll: true })
  }, [focusRequest])

  // 명소를 여는 유일한 경로다. 목록 행·지도 마커·「오늘의 서울」의 순위 목록이
  // 모두 여기로 들어온다 — 어디서 열든 시트가 상세로 가득 차야 같은 화면이 된다.
  //
  // **`useCallback`을 걸지 마라.** Task 9까지 걸려 있었지만 이유는 성능이
  // 아니었다. 마커의 `onClick`은 `() => openArea(...)` 인라인 화살표라 이 함수가
  // 안정적이든 아니든 매 렌더 새것이고, 닿았더라도 소용이 없다 — vis.gl의
  // `useDomEventListener`가 리스너를 다는 effect의 의존성이
  // `[target, name, isCallbackDefined]`라 **콜백 신원을 아예 보지 않는다**
  // (node_modules에서 확인했다). 목록·상세·오늘의 서울도 `memo`가 아니다.
  // 유일하게 남아 있던 근거는 렌더 중에 이 함수를 부르던 `focusArea` 조정이
  // 읽기 어려워진다는 것이었는데, 그 조정이 탭바와 함께 사라졌다.
  //
  // **시트를 올리지 않는다.** Task 10까지 여기서 `setDetent('full')`을 불렀는데,
  // 목록에서 한 곳을 누르면 시트가 화면의 92%로 튀어올라 지도가 통째로 사라졌다.
  // 지도 위에 시트를 얹은 이 화면의 전제가 명소를 누를 때마다 무너진 셈이다.
  //
  // 「올리지 않는다」가 아니라 **「언제나 half」**인 이유는 반대쪽 끝 때문이다.
  // 현재 단계를 그대로 두면 full로 펼쳐 둔 채 누른 상세가 full에 앉아 지도가
  // 여전히 안 보이고, peek에서 마커를 누른 상세는 135px 틈에 갇혀 안 보인다.
  // 어디서 열든 같은 화면이 되어야 한다는 이 함수의 존재 이유가 단계에도 그대로
  // 적용된다 — 상세의 높이는 하나뿐이고, 그 하나는 지도가 44% 남는 half다.
  //
  // 「목록으로」(`onBack`)와 같은 값이라 여닫는 길이 대칭이다. 상세를 열고 닫는
  // 동안 시트는 아예 움직이지 않는다.
  function openArea(name: string): void {
    setSelectedName(name)
    setView('list')
    setDetent('half')
    requestSheetFocus()
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

  // 지도를 못 그리는 두 경우를 한 값으로 모은다. 「레이어를 비우는가」와
  // 「시트를 half에 묶는가」와 「어떤 안내를 그리는가」가 전부 이 값 하나를
  // 보므로 셋의 판정이 갈릴 자리가 없다.
  //
  // 키 미설정과 로드 실패를 나누는 이유는 그대로다 — 개발자는 "왜 안 뜨지"에서
  // 키를 의심하고 사용자는 네트워크를 의심하는데, 문구가 하나면 양쪽 다 엉뚱한
  // 곳을 본다. 로드 실패는 스크립트를 못 받은 경우다(오프라인·차단·잘못된 키).
  const mapUnavailableReason: MapUnavailableReason | null = !isMapAvailable()
    ? 'no-key'
    : loadFailed
      ? 'load-failed'
      : null
  const mapReady = mapUnavailableReason === null

  // 지도를 못 쓰면 시트를 half에 묶는다. 지도 안내가 화면의 92%를 차지할 이유가
  // 없고, 접을 수 있게 두면 안내가 사라져 더 헷갈린다.
  //
  // **이 줄이 그 규칙이 사는 유일한 자리다.** 오버레이·FAB·시트가 모두 이 값을
  // 보므로 규칙을 여러 곳에 흩어 놓으면 한쪽만 고쳐지는 날이 온다.
  // `onDetentChange`에 noop을 물려 「지도가 죽었으면 단계를 바꾸지 마라」를
  // 한 번 더 쓰는 길도 있었지만 두지 않았다 — 그건 같은 규칙의 두 번째 사본인
  // 데다, `mapReady`가 false→true로 돌아오지 않아 숨은 `detent`가 갈려도
  // 화면에 드러날 길이 없어서 **테스트로 지킬 수도 없다.**
  const sheetDetent: Detent = mapReady ? detent : 'half'

  function handleCameraChanged(event: MapCameraChangedEvent): void {
    setCenter(event.detail.center)
    setZoom(event.detail.zoom)
  }

  // 담은 게 없는 「내 장소」를 켜면 목록도 지도 마커도 함께 빈다. peek에서는
  // 왜 그런지 적은 문구가 시트 안에 가려 있어 사용자에게는 「눌렀더니 다
  // 사라졌다」만 남으므로, 답이 보이는 높이까지 시트를 올린다.
  //
  // **화면상** 움직이는 것은 peek → half뿐이다. 칩 열을 가르는 것은 `detent`가
  // 아니라 `sheetDetent`(= `mapReady ? detent : 'half'`)라, 지도가 죽어 시트가
  // half에 묶인 동안에는 `detent`가 `'full'`인 채로도 칩이 그려진다 — 그때
  // 이 줄은 보이지 않는 `detent`만 'half'로 되돌린다. 눈에 띄는 변화는 없고,
  // 지도가 살아 돌아올 길이 없어(`loadFailed`는 되돌지 않는다) 드러날 일도 없다.
  //
  // 「목록이 비면 올린다」로 일반화하지 않았다. 카테고리로 좁혀 비는 경우는
  // 칩이 0에서도 눌리게 만든 이 태스크와 무관하게 예전부터 있던 상태이고,
  // 그쪽까지 손대면 필터를 만질 때마다 시트가 튀어오른다.
  function handleFilterChange(next: FilterKey | null): void {
    filters.setFilter(next)
    if (next === 'fav' && favorites.length === 0) {
      setDetent('half')
    }
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

  // **지도를 못 그리면 이 레이어는 비운다.** 안내는 여기가 아니라 아래 오버레이
  // 열이 갖는다 — 근거는 그쪽 주석에 한 벌 있다.
  const mapPane = !mapReady ? null : (
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
            // 겹친 핀 중 붐비는 쪽이 위에 온다. 규칙은 `domain/map`이 갖는다 —
            // 여기서 `level === '붐빔' ? 4 : …`로 풀면 같은 판정이 두 곳에 산다.
            zIndex={markerZIndex(marker.level)}
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
  //
  // 「내 장소」가 걸렸는데 담은 것이 하나도 없는 경우만 따로 말한다. 이 자리가
  // Task 10에서 사라진 즐겨찾기 화면의 빈 상태 안내를 물려받는다 — 그 화면이
  // 없으면 신규 사용자에게 「어떻게 담는가」를 말하는 곳이 앱에 하나도 없다.
  // 「‘내 장소’에 해당하는 명소가 없어요」로는 못 대신한다: 담은 것은 있는데
  // 지금 조건에 안 걸린다는 뜻이라 아직 아무것도 안 담은 사람에게는 거짓이다.
  //
  // 옛 문구(「지도에서 ☆를 눌러 담아보세요」)를 그대로 옮기지 않았다. Task 8에서
  // 별이 상세 헤더를 떠나 액션 행의 「저장」 버튼이 됐으므로 그 문구대로 하면
  // 있지도 않은 ☆를 찾게 된다. 함께 있던 「지도로 가기」 버튼도 옮기지 않는다 —
  // 지도는 이미 이 문구 뒤에 깔려 있고, 빠져나올 길은 아래 「필터 해제」다.
  //
  // 세는 것은 `counts.fav`가 아니라 `favorites`다. 카테고리로 좁혀 0이 된 것과
  // 애초에 담은 게 없는 것은 사용자에게 다른 말이다.
  const clearableFilter = filters.query === '' ? filters.filter : null
  const emptyMessage =
    filters.query !== ''
      ? `「${filters.query}」에 해당하는 명소가 없어요.`
      : clearableFilter === 'fav' && favorites.length === 0
        ? '아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.'
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
              requestSheetFocus()
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

      {/* 카드가 아니라 행이다 — 이 자리에 올 것이 `AreaList`이기 때문이다.
          `SkeletonList`(카드)를 쓰면 데이터가 오는 순간 레이아웃이 통째로
          바뀐다. */}
      {snapshots.isPending && (
        <div className="px-4">
          <SkeletonRows count={6} />
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
        // `role="status"`가 없으면 이 문구는 **눈에만** 있다. 특히 「내 장소」를
        // 0에서도 누를 수 있게 만든 이유가 「누르면 답이 나온다」인데, 칩을
        // 누르면 포커스는 칩에 그대로 있고 시트만 올라오므로 스크린리더에
        // 가는 신호는 「선택됨」 하나뿐이다 — 접근성을 위해 만든 면제가
        // 접근성 채널에서만 답을 안 주는 꼴이 된다.
        //
        // 상자째 감싸므로 「필터 해제」 버튼의 존재까지 함께 낭독된다. 그 버튼은
        // half에서 4.2px만 노출되는 자리라(Task 10 실측) 소리로 먼저 알려주는
        // 편이 오히려 낫다.
        //
        // 검색어를 한 글자씩 칠 때마다 문구가 바뀌어 낭독이 반복되는 값을
        // 치른다. 「내 장소일 때만」으로 좁히면 그 소음은 없어지지만 **규칙이
        // 하나 더 늘고**, 어떤 빈 상태는 말하고 어떤 빈 상태는 침묵하는
        // 화면이 된다 — 검색 결과를 폴라이트 리전으로 알리는 것은 표준 패턴
        // 이기도 해서 일관성 쪽을 골랐다.
        <div role="status" className="px-4 py-10 text-center">
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
        {/* 목록 뷰에는 눈에 보이는 제목이 없다. 상세는 히어로의 h2, 오늘의
            서울은 절 제목을 갖는데 여기만 `App`의 h1 아래가 비어서, 제목으로
            훑는 스크린리더 사용자에게 기본 화면이 통째로 빈 칸이었다.
            제목이 가리키는 것은 목록 자체다 — 위의 요약 줄·필터·정렬까지
            덮는 이름을 붙이면 실제 구조와 어긋난다. */}
        <h2 className="sr-only">명소 목록</h2>
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
          requestSheetFocus()
        }}
        onSelectArea={openArea}
      />
    ) : view === 'today' ? (
      <TodayScreen
        onSelectArea={openArea}
        onBack={() => {
          setView('list')
          setDetent('half')
          requestSheetFocus()
        }}
      />
    ) : (
      listPane
    )

  return (
    <div className="relative size-full overflow-hidden">
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
          히트 영역이 44~88px인데 이 열이 **0~112px**을 덮는다(검색 바 64px +
          간격 4px + 칩 줄 44px. Task 10에서 헤드리스 크롬으로 실측했다 —
          Task 9는 88px로 적었는데 틀린 값이었고, 결론은 오히려 강해졌다).
          컨테이너 높이와 무관한 고정 높이라 어느 기기에서도 같다. 둘 다
          `pointer-events-auto`이고 폭이 화면 전체라 손잡이를 **통째로** 가려
          full에서는 시트를 잡을 수가 없다.

          FAB: full에서는 48px가 들어갈 자리가 사실상 없다 — 버튼 몫이 `0.06H`라
          `H ≥ 800px`이라야 안 잘린다. Task 10에서 상단바·탭바가 빠져 컨테이너가
          곧 뷰포트가 됐으므로(`100dvh`) 이 조건은 「뷰포트 800px 이상」이 됐고,
          세로가 긴 기기에서는 닿을 수 있다. 그래도 화면 크기로 갈라 그리지
          않는다 — 규칙이 둘이 되고 작은 기기에서는 여전히 잘린다.
          자세한 산식은 `RecenterButton`에 있다.

          `opacity-0`이 아니라 조건부 렌더다. 그래야 포인터 이벤트와 접근성
          트리가 함께 정리되고, 사라졌다는 사실을 테스트로 잠글 수 있다.

          `sheetDetent`가 여기서 `RecenterDetent`로 좁혀지므로 「FAB은 full에
          설 자리가 없다」는 불변식을 컴파일러가 지킨다 — 좁혀지지 않은 값을
          넘기면 `TS2322`가 난다(확인했다).

          **파생 불리언(`const show = sheetDetent !== 'full'`)으로 감싸도 좁혀진다.**
          TS 4.4의 aliased conditions and discriminants가 처리하고, 이 저장소는
          TS ~6.0.2다 — 실제로 바꿔 `tsc -b --force`를 돌려 에러 0을 확인했다.
          여기서 직접 비교하는 것은 타입 때문이 아니라, 조건과 그 조건이 지배하는
          JSX가 한눈에 붙어 있는 편이 읽기 쉬워서다. 쪼개도 타입 안전은 안 깨지니
          필요하면 쪼개도 된다.

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
              onChange={handleFilterChange}
            />

            {/* **지도를 대신하는 안내라 지도 위가 아니라 이 열의 마지막 칸이다.**
                지도 레이어에 두면 이 오버레이가 통째로 덮는다: 오버레이는 `z-20`
                으로 화면 위 0~112px을 차지하는데(검색 바 64 + 간격 4 + 칩 줄 44,
                Task 10 실측) `ErrorState`의 `py-10` 때문에 안내 문구는 y≈64px에서
                시작한다. 390px 헤드리스 크롬으로 찍어 보니 칩 사이 틈으로 글자
                조각만 새어 나오고, 사용자에게는 아무 설명 없는 빈 화면이었다.

                흐름대로 칩 아래에 놓이므로 오버레이 높이가 바뀌면 따라온다 —
                112px을 여기에 다시 적어 두지 않아도 되는 것이 이 자리의 값이다.
                가운데 정렬로 피하는 길도 있었지만 그건 뷰포트가 작아질수록
                오버레이 쪽으로 밀려 올라가 640px 아래에서 다시 겹친다(계산).

                `pointer-events-auto`가 필요하다. 이 컨테이너는 칩 줄과 검색 바
                사이의 빈 곳에서 지도를 끌 수 있게 `pointer-events-none`이라,
                되살리지 않으면 안내 글자를 고를 수도 없다. */}
            {mapUnavailableReason !== null && (
              <div className="pointer-events-auto">
                <MapUnavailableNotice reason={mapUnavailableReason} />
              </div>
            )}
          </div>

          <RecenterButton
            disabled={location.coords === null}
            detent={sheetDetent}
            onClick={handleRecenter}
          />
        </>
      )}

      <BottomSheet detent={sheetDetent} onDetentChange={setDetent}>
        {/* 여백을 걸지 않는다 — 시트의 규칙이 아니라 뷰의 몫이다(BottomSheet
            주석 참조). 이 상자는 오직 포커스를 받기 위한 것이다.

            **각 뷰의 맨 위 버튼이 아니라 감싸는 상자에 준다.** 목록의 맨 위인
            요약 스트립은 조회가 실패하면 아예 안 그려져서(위 `snapshots.isError`
            분기) 「맨 위 요소」가 뷰마다 있다고 말할 수가 없다. 상자는 뷰가
            셋 중 무엇으로 갈리든 언제나 있고 언마운트되지 않는다 — 「포커스를
            옮긴 뒤 그 요소가 사라지면?」이 표현 불가능한 상태가 된다.

            **이름을 주지 않은 것은 고른 것이다.** `tabindex="-1"`인 div는
            암묵 role이 `generic`이고 `generic`은 **이름 부여가 금지된**
            role이라, 나중에 `aria-label`만 얹으면 조용히 무시된다. 이름을
            주려면 `role="group"`(또는 `region`)이 함께 와야 한다. 지금 이름을
            안 주는 쪽을 고른 이유는 이 상자가 뷰의 경계가 아니라 포커스
            받침대일 뿐이어서 — 뷰의 정체는 그 안 첫 요소(「목록으로」,
            요약 스트립)가 이미 말한다.

            포커스가 왔을 때 스크린리더가 실제로 무엇을 읽는지는 실기기로만
            확인된다 — STATE.md의 미해결 항목. */}
        <div ref={viewRef} tabIndex={-1}>
          {sheetContent}
        </div>
      </BottomSheet>
    </div>
  )
}
