import { useState } from 'react'
import { LocationProvider } from './app/LocationProvider'
import { QueryProvider } from './app/QueryProvider'
import { BottomTabBar, type TabKey } from './components/layout/BottomTabBar'
import { TopAppBar } from './components/layout/TopAppBar'
import { ForecastScreen } from './screens/ForecastScreen'
import { MapScreen } from './screens/MapScreen'
import { MoreScreen } from './screens/MoreScreen'
import { NearbyScreen } from './screens/NearbyScreen'

// 탭에 걸린 화면 셋. 'forecast'는 여기 오지 않는다 — handleTab이 걸러낸다.
function TabScreen({
  tab,
  onSelectArea,
}: {
  readonly tab: TabKey
  readonly onSelectArea: (name: string) => void
}) {
  if (tab === 'map') {
    return <MapScreen onSelectArea={onSelectArea} />
  }
  if (tab === 'more') {
    return <MoreScreen />
  }
  return <NearbyScreen onSelectArea={onSelectArea} />
}

// 화면이 넷이라 라우터 대신 상태로 전환한다. 라우터를 넣으면 토스 웹뷰의
// 딥링크 처리까지 검증해야 하는데 아직 범위 밖이다.
function AppShell() {
  const [tab, setTab] = useState<TabKey>('nearby')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  // 탭을 selectedArea로 유추하지 않는다. 탭이 셋이 되는 순간 "명소를 안 골랐으면
  // 내 주변"이라는 유추가 지도 탭을 삼킨다.
  const activeTab: TabKey = selectedArea === null ? tab : 'forecast'

  function handleTab(key: TabKey): void {
    // 혼잡예보는 명소를 골라야 열리는 상세 화면이라 독립 화면이 없다. 탭
    // 상태로 받으면 강조만 옮겨가고 내용은 그대로라 탭바가 거짓말을 한다.
    if (key === 'forecast') return
    setSelectedArea(null)
    setTab(key)
  }

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <main className="flex-1">
        {selectedArea !== null ? (
          // 상단 바는 ForecastScreen이 직접 그린다. 명소를 못 찾은 경우에도
          // 뒤로 갈 수 있어야 해서 화면 안쪽에 있어야 한다.
          //
          // 뒤로 가면 tab은 그대로라 들어온 탭으로 돌아간다 — 지도에서 마커를
          // 눌러 들어왔는데 「내 주변」으로 튕기면 맥락이 끊긴다.
          //
          // 보존되는 건 탭까지다. 상세로 들어가면 MapScreen이 언마운트되므로
          // 카메라(center·zoom)와 선택 상태는 초기값으로 돌아간다. 지도 위치까지
          // 지키려면 카메라 상태를 여기로 끌어올려야 한다 — 아직 안 했다.
          <ForecastScreen
            areaName={selectedArea}
            onBack={() => setSelectedArea(null)}
            onSelectArea={setSelectedArea}
          />
        ) : (
          <>
            <TopAppBar title="Seoul Live" />
            <TabScreen tab={tab} onSelectArea={setSelectedArea} />
          </>
        )}
      </main>
      <BottomTabBar active={activeTab} onSelect={handleTab} />
    </div>
  )
}

export default function App() {
  return (
    <QueryProvider>
      <LocationProvider>
        <AppShell />
      </LocationProvider>
    </QueryProvider>
  )
}
