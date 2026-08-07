import { useState } from 'react'
import { LocationProvider } from './app/LocationProvider'
import { QueryProvider } from './app/QueryProvider'
import { BottomTabBar, type TabKey } from './components/layout/BottomTabBar'
import { TopAppBar } from './components/layout/TopAppBar'
import { FavoritesScreen } from './screens/FavoritesScreen'
import { HomeScreen } from './screens/HomeScreen'
import { TodayScreen } from './screens/TodayScreen'

// 화면이 셋이라 라우터 대신 상태로 전환한다. 라우터를 넣으면 토스 웹뷰의
// 딥링크 처리까지 검증해야 하는데 아직 범위 밖이다.
function AppShell() {
  const [tab, setTab] = useState<TabKey>('home')
  // 즐겨찾기·오늘의 서울에서 명소를 누르면 홈으로 옮겨 상세를 연다.
  // 여기 있는 건 "어디로 보낼 것인가"뿐이고 홈의 필터·카메라 상태는
  // 여전히 HomeScreen 안에 있다.
  const [focusArea, setFocusArea] = useState<string | null>(null)

  function openArea(name: string): void {
    setFocusArea(name)
    setTab('home')
  }

  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* 상단바는 앱 이름만 든다. 각 화면이 자기 제목을 갖는다. */}
      <TopAppBar title="Seoul Live" />
      <main className="flex-1">
        {/* 홈은 언제나 마운트된 채로 둔다. 탭을 오갈 때마다 새로 만들면
            google.maps.Map이 다시 생성돼 타일을 다시 받고 카메라가 서울
            전역으로 돌아간다. 선택·검색·분할 비율도 함께 날아간다. */}
        <div hidden={tab !== 'home'}>
          <HomeScreen focusArea={focusArea} />
        </div>
        {tab === 'favorites' && (
          <FavoritesScreen onSelectArea={openArea} onGoHome={() => setTab('home')} />
        )}
        {tab === 'more' && <TodayScreen onSelectArea={openArea} />}
      </main>
      <BottomTabBar active={tab} onSelect={setTab} />
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
