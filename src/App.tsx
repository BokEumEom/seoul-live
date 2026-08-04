import { useState } from 'react'
import { QueryProvider } from './app/QueryProvider'
import { BottomTabBar, type TabKey } from './components/layout/BottomTabBar'
import { TopAppBar } from './components/layout/TopAppBar'
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
          <>
            <TopAppBar
              title={selectedArea}
              onBack={() => setSelectedArea(null)}
            />
            {/* 혼잡예보 화면(T18)은 아직이다. */}
            <p className="px-4 py-16 text-center text-sm text-on-surface-variant">
              혼잡예보 화면은 준비 중이에요.
            </p>
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
      <AppShell />
    </QueryProvider>
  )
}
