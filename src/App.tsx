import { useState } from 'react'
import { QueryProvider } from './app/QueryProvider'
import { BottomTabBar, type TabKey } from './components/layout/BottomTabBar'
import { TopAppBar } from './components/layout/TopAppBar'
import { ForecastScreen } from './screens/ForecastScreen'
import { NearbyScreen } from './screens/NearbyScreen'

// 화면이 둘뿐이라 라우터 대신 상태로 전환한다. 라우터를 넣으면 토스 웹뷰의
// 딥링크 처리까지 검증해야 하는데 1차 범위 밖이다.
function AppShell() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const activeTab: TabKey = selectedArea === null ? 'nearby' : 'forecast'

  function handleTab(key: TabKey): void {
    if (key === 'nearby') {
      setSelectedArea(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <main className="flex-1">
        {selectedArea === null ? (
          <>
            <TopAppBar title="Seoul Live" />
            <NearbyScreen onSelectArea={setSelectedArea} />
          </>
        ) : (
          // 상단 바는 ForecastScreen이 직접 그린다. 명소를 못 찾은 경우에도
          // 뒤로 갈 수 있어야 해서 화면 안쪽에 있어야 한다.
          <ForecastScreen
            areaName={selectedArea}
            onBack={() => setSelectedArea(null)}
          />
        )}
      </main>
      <BottomTabBar active={activeTab} onSelect={handleTab} />
    </div>
  )
}

export default function App() {
  return (
    <QueryProvider>
      <AppShell />
    </QueryProvider>
  )
}
