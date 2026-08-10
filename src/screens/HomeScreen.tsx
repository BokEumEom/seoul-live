import {
  AdvancedMarker,
  APIProvider,
  Map,
  type MapCameraChangedEvent,
} from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { SkeletonList } from '../components/common/SkeletonCard'
import { AreaDetail } from '../components/home/AreaDetail'
import { SearchBar } from '../components/home/SearchBar'
import { SplitPane } from '../components/home/SplitPane'
import { AreaListItem } from '../components/list/AreaListItem'
import { CategoryFilter } from '../components/list/CategoryFilter'
import { LocationNotice } from '../components/list/LocationNotice'
import { SortSegmented } from '../components/list/SortSegmented'
import { CongestionMarker } from '../components/map/CongestionMarker'
import { MapUnavailableNotice } from '../components/map/MapUnavailableNotice'
import { PresetFilter } from '../components/map/PresetFilter'
import { RecenterButton } from '../components/map/RecenterButton'
import { AREA_CATALOG, AREA_NAMES } from '../data/areas'
import { useAreaSnapshots } from '../data/queries'
import {
  DEFAULT_ZOOM,
  SEOUL_CENTER,
  shouldShowMarkerLabel,
  toMapMarkers,
} from '../domain/map'
import { filterByPreset, presetCounts } from '../domain/presets'
import { searchAreas } from '../domain/search'
import { SHEET_RATIO } from '../domain/sheet'
import type { Coords } from '../domain/types'
import { useHomeFilters } from '../hooks/useHomeFilters'
import { buildNearbyList } from '../hooks/useNearbyAreas'
import {
  googleMapsApiKey,
  googleMapsMapId,
  isMapAvailable,
} from '../platform/googleMaps'

/** 재조정 버튼을 눌렀을 때의 줌. 주변 명소가 몇 곳 들어오는 정도다. */
const RECENTER_ZOOM = 14

const LOADING_LABEL = '혼잡도를 불러오는 중'

// 상단바(3.5rem)와 하단 탭바(3.5rem), 안전 영역 여유를 뺀 높이. SplitPane이
// 이 안에서 지도와 목록을 나눠 갖는다. <Map>은 부모가 크기를 정한다고
// 가정하므로 여기서 높이를 주지 않으면 지도가 0px로 접힌다.
// iOS 안전 영역을 포함한 실제 값은 실기기로만 확정된다 — STATE.md의 미해결 항목.
const HOME_HEIGHT_CLASS = 'h-[calc(100dvh-7.5rem)]'

interface Props {
  /** 즐겨찾기·오늘의 서울에서 명소를 눌러 홈으로 넘어올 때. */
  readonly focusArea?: string | null
}

export function HomeScreen({ focusArea = null }: Props) {
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()
  const filters = useHomeFilters()

  // 초기 뷰는 위치 권한과 무관하게 서울 전역이다. 내 위치로 자동 이동하면
  // 서울 밖 사용자에게 마커가 하나도 없는 지도가 뜬다.
  const [center, setCenter] = useState<Coords>(SEOUL_CENTER)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [loadFailed, setLoadFailed] = useState(false)

  const { setSelectedName, setSort } = filters

  // focusArea가 바뀔 때만 선택을 옮긴다. 의존성에 filters를 넣으면 매 렌더
  // 새 객체라 무한 루프가 된다.
  useEffect(() => {
    if (focusArea !== null) {
      setSelectedName(focusArea)
    }
  }, [focusArea, setSelectedName])

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

  // 개수는 걸러지기 전 목록으로 센다. 걸러진 목록으로 세면 프리셋 하나를
  // 고르는 순간 나머지 두 칩이 0이 되어 비활성으로 굳고, 다른 목적으로
  // 갈아탈 방법이 사라진다.
  const counts = presetCounts(list)
  const visible = searchAreas(filterByPreset(list, filters.preset), filters.query)

  // 로딩 중에는 마커를 세우지 않는다. 스냅샷이 없는 명소는 회색 "정보 없음"으로
  // 그려지는데, 아직 안 온 것과 없는 것은 사용자에게 다른 말이다.
  const markers = snapshots.isPending ? [] : toMapMarkers(visible)
  const showLabel = shouldShowMarkerLabel(zoom)
  const mapReady = isMapAvailable() && !loadFailed

  function handleCameraChanged(event: MapCameraChangedEvent): void {
    setCenter(event.detail.center)
    setZoom(event.detail.zoom)
  }

  // 「내 주변」은 지도를 내 위치로 옮기고 목록을 거리순으로 바꾼다. 탭이었던
  // 것이 동작이 됐다.
  function handleRecenter(): void {
    if (location.coords === null) return
    setCenter(location.coords)
    setZoom(RECENTER_ZOOM)
    setSort('distance')
  }

  const mapPane = !isMapAvailable() ? (
    <MapUnavailableNotice reason="no-key" />
  ) : loadFailed ? (
    // 스크립트를 못 받은 경우다(오프라인·차단·잘못된 키). 키 미설정과 문구를
    // 나눠야 개발자와 사용자가 각각 맞는 곳을 의심한다.
    <MapUnavailableNotice reason="load-failed" />
  ) : (
    <div className="relative size-full">
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
              position={{ lat: marker.entry.lat, lng: marker.entry.lng }}
              onClick={() => setSelectedName(marker.entry.name)}
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

      <PresetFilter counts={counts} value={filters.preset} onChange={filters.setPreset} />

      {snapshots.isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center">
          <span className="rounded-full bg-surface px-3 py-1.5 text-label-sm text-on-surface-variant shadow-floating">
            {LOADING_LABEL}
          </span>
        </div>
      )}

      <RecenterButton
        disabled={location.coords === null}
        raised={false}
        onClick={handleRecenter}
      />
    </div>
  )

  const listPane =
    filters.selectedName !== null ? (
      <AreaDetail
        areaName={filters.selectedName}
        onBack={() => setSelectedName(null)}
        onSelectArea={setSelectedName}
      />
    ) : (
      <div className="flex flex-col gap-3 pb-6">
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

        {!snapshots.isPending && visible.length === 0 && (
          <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
            {filters.query === ''
              ? '조건에 맞는 명소가 없어요.'
              : `「${filters.query}」에 해당하는 명소가 없어요.`}
          </p>
        )}

        <div className="flex flex-col gap-3 px-4">
          {visible.map((area) => (
            <AreaListItem
              key={area.entry.code}
              area={area}
              onSelect={setSelectedName}
            />
          ))}
        </div>
      </div>
    )

  return (
    <div className={`w-full ${HOME_HEIGHT_CLASS}`}>
      <SearchBar
        value={filters.query}
        onChange={filters.setQuery}
        onRecenter={handleRecenter}
        canRecenter={location.coords !== null}
      />

      {/* 키가 없으면 지도 자리를 최소로 접는다. 안내 문구가 화면 절반을
          차지할 이유가 없다. */}
      <div className="h-[calc(100%-4rem)]">
        <SplitPane
          ratio={mapReady ? filters.mapRatio : SHEET_RATIO.peek}
          onRatioChange={filters.setMapRatio}
          top={mapPane}
          bottom={listPane}
        />
      </div>
    </div>
  )
}
