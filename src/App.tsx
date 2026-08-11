import { LocationProvider } from './app/LocationProvider'
import { QueryProvider } from './app/QueryProvider'
import { HomeScreen } from './screens/HomeScreen'

// 화면이 하나다. 즐겨찾기는 필터 칩이 됐고 「오늘의 서울」은 시트 안 뷰가 돼서
// 탭으로 갈 곳이 남지 않았다 — 설계 §2.2. 라우터도 없다: 상태로 나눌 화면조차
// 없어졌으므로 남은 것은 이 한 장뿐이다.
//
// **상단바도 없다.** 탭바를 걷은 논리가 그대로 적용된다 — 오버레이 시트를
// 채택한 이상 세로 공간이 가장 귀한 자원이고, 상단바 3.5rem은 시트를 full로
// 올린 상태에서도 계속 깎인다. 게다가 지도 위에 뜬 검색 바가 이미 그 층을
// 쓰고 있어 같은 자리가 두 겹이었고, 토스가 미니앱에 자체 네이티브 헤더를
// 주므로 유지하면 세 겹이 됐다.
//
// 감쌌던 `flex flex-col` 열도 함께 걷었다. 높이를 나눠 가질 형제가 없으면
// `min-h-0 flex-1`은 할 일이 없다. 대신 **`h-dvh`는 빼면 안 된다** —
// `HomeScreen` 루트가 `size-full`(= `height: 100%`)이라 높이가 auto인 부모를
// 만나면 지도가 0px로 접힌다.
function AppShell() {
  return (
    <main className="h-dvh bg-surface">
      {/* 눈에 보이는 제목은 두지 않는다(위 참조). 그래도 h1은 남긴다:
          `TopAppBar`의 것이 앱의 유일한 h1이었고, 없애면 제목 층이 시트 안의
          h2부터 시작해 제목으로 훑는 스크린리더 사용자에게 뿌리 없는 트리가
          된다. `sr-only`라 세로 공간을 한 픽셀도 쓰지 않으므로 상단바를 없앤
          이득과 상충하지 않는다.

          이름은 index.html의 <title>과 같은 「서울 라이브」다. `TopAppBar`는
          「Seoul Live」였고 둘이 어긋나 있었다 — 상단바가 사라지며 해소된다. */}
      <h1 className="sr-only">서울 라이브</h1>
      <HomeScreen />
    </main>
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
