import {
  AdvancedMarker,
  APIProvider,
  Map,
  type MapCameraChangedEvent,
} from '@vis.gl/react-google-maps'
import { useMemo, useState } from 'react'
import { useLocation } from '../app/locationContext'
import { ErrorState } from '../components/common/ErrorState'
import { AreaSheet } from '../components/map/AreaSheet'
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
import type { Coords } from '../domain/types'
import { buildNearbyList } from '../hooks/useNearbyAreas'
import {
  googleMapsApiKey,
  googleMapsMapId,
  isMapAvailable,
} from '../platform/googleMaps'

/** 재조정 버튼을 눌렀을 때의 줌. 주변 명소가 몇 곳 들어오는 정도다. */
const RECENTER_ZOOM = 14

const LOADING_LABEL = '혼잡도를 불러오는 중'

// 상단바(3.5rem)와 하단 탭바(3.5rem), 안전 영역 여유를 뺀 높이. <Map>은 컨테이너를
// width:100%/height:100%로 채우고 "부모가 크기를 정한다"고 가정하므로, 여기서
// 명시적인 높이를 주지 않으면 지도가 0px로 접힌다.
// iOS 안전 영역을 포함한 실제 값은 실기기로만 확정된다 — STATE.md의 미해결 항목.
const MAP_HEIGHT_CLASS = 'h-[calc(100dvh-7.5rem)]'

interface Props {
  readonly onSelectArea: (name: string) => void
}

export function MapScreen({ onSelectArea }: Props) {
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  // 초기 뷰는 위치 권한과 무관하게 서울 전역이다. 내 위치로 자동 이동하면
  // 서울 밖 사용자에게 마커가 하나도 없는 지도가 뜬다.
  const [center, setCenter] = useState<Coords>(SEOUL_CENTER)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [loadFailed, setLoadFailed] = useState(false)

  // 「내 주변」과 같은 조립을 쓴다. 거리는 바텀시트에서 보여주므로 필요하다.
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

  // 키가 없으면 지도를 그릴 수 없다. 나머지 화면 둘은 그대로 동작한다.
  if (!isMapAvailable()) {
    return <MapUnavailableNotice reason="no-key" />
  }

  // 스크립트를 못 받은 경우다(오프라인·차단·잘못된 키). 키 미설정과 문구를
  // 나눠야 개발자와 사용자가 각각 맞는 곳을 의심한다.
  if (loadFailed) {
    return <MapUnavailableNotice reason="load-failed" />
  }

  // 로딩 중에는 마커를 세우지 않는다. 스냅샷이 없는 명소는 회색 "정보 없음"으로
  // 그려지는데(toMapMarkers), 아직 안 온 것과 없는 것은 사용자에게 다른 말이다.
  const markers = snapshots.isPending ? [] : toMapMarkers(list)
  const showLabel = shouldShowMarkerLabel(zoom)
  const selected = list.find((area) => area.entry.name === selectedName) ?? null

  function handleCameraChanged(event: MapCameraChangedEvent): void {
    setCenter(event.detail.center)
    setZoom(event.detail.zoom)
  }

  function handleRecenter(): void {
    if (location.coords === null) return
    setCenter(location.coords)
    setZoom(RECENTER_ZOOM)
  }

  return (
    <div className={`relative w-full ${MAP_HEIGHT_CLASS}`}>
      <APIProvider
        apiKey={googleMapsApiKey()}
        onError={(error) => {
          // 사용자에게는 일반 문구를 보여주지만 원인은 남겨야 한다.
          console.error('지도 스크립트를 불러오지 못했습니다:', error)
          setLoadFailed(true)
        }}
      >
        <Map
          mapId={googleMapsMapId()}
          center={center}
          zoom={zoom}
          onCameraChanged={handleCameraChanged}
          // 탭을 오갈 때마다 이 화면이 언마운트된다. reuseMaps가 없으면 그때마다
          // google.maps.Map을 새로 만드는데, 이 인스턴스는 완전히 회수되지 않는
          // 것으로 알려져 있어 메모리가 계단식으로 늘고 타일도 다시 받는다.
          reuseMaps
          // 지도는 심사 체크리스트가 제스처 확대·축소를 명시적으로 허용하는 용례다.
          gestureHandling="greedy"
          disableDefaultUI
          className="size-full"
        >
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
                selected={marker.entry.name === selectedName}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>

      {snapshots.isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
          <span className="rounded-full bg-surface px-3 py-1.5 text-label-sm text-on-surface-variant shadow-floating">
            {LOADING_LABEL}
          </span>
        </div>
      )}

      {snapshots.isError && (
        // 바깥은 pointer-events-none으로 둬야 지도 드래그를 막지 않는다. 안쪽
        // 박스만 되살려서 재시도 버튼이 실제로 눌리게 한다.
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20">
          <div className="pointer-events-auto">
            <ErrorState
              message="혼잡도 정보를 가져오지 못했어요."
              onRetry={() => void snapshots.refetch()}
            />
          </div>
        </div>
      )}

      <RecenterButton
        disabled={location.coords === null}
        raised={selected !== null}
        onClick={handleRecenter}
      />

      <AreaSheet
        area={selected}
        onClose={() => setSelectedName(null)}
        onOpenForecast={onSelectArea}
      />
    </div>
  )
}
