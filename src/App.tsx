import { t } from './i18n/t'
import { LocationProvider } from './app/LocationProvider'
import { QueryProvider } from './app/QueryProvider'
import { useLanguage } from './hooks/languageStore'
import { useAppTheme } from './hooks/themeStore'
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
  // 저장해 둔 화면 테마를 읽어 칠하고, 「기기 설정」을 고른 사용자를 위해
  // 기기 변화를 듣는다. 여기서 부르는 이유는 `useAppTheme` 주석에 있다 —
  // 설정 UI는 「오늘의 서울」 안이라 열지 않으면 영영 안 그려진다.
  useAppTheme()
  // **언어를 여기서 구독한다.** `t()`가 훅이 아니라 모듈 함수라(근거는
  // `i18n/t.ts`) 언어가 바뀌어도 컴포넌트들이 스스로는 다시 그려지지 않는다.
  // 루트가 구독해 두면 언어가 바뀔 때 루트가 다시 그려지고, 그 아래 트리
  // 전체가 새 문자열로 렌더된다 — 51개 파일에 배선을 넣지 않아도 되는 값이다.
  useLanguage()

  return (
    <main className="h-dvh bg-surface">
      {/* 눈에 보이는 제목은 두지 않는다(위 참조). 그래도 h1은 남긴다:
          `TopAppBar`의 것이 앱의 유일한 h1이었고, 없애면 제목 층이 시트 안의
          h2부터 시작해 제목으로 훑는 스크린리더 사용자에게 뿌리 없는 트리가
          된다. `sr-only`라 세로 공간을 한 픽셀도 쓰지 않으므로 상단바를 없앤
          이득과 상충하지 않는다.

          이름은 index.html의 <title>과 같은 「서울 라이브」다. `TopAppBar`는
          「Seoul Live」였고 둘이 어긋나 있었다 — 상단바가 사라지며 해소된다.

          **감싸는 이유:** 앱의 접근성 이름이라 영어 사용자에게는 영어로
          읽혀야 한다. 공유 문구가 이미 「Seoul Live」로 나가고 있어서
          감싸지 않으면 같은 브랜드가 한 앱 안에서 두 이름으로 불린다.
          `index.html`의 `<title>`은 한국어로 남는다 — 정적 파일이라 언어
          스토어가 닿지 않는다. */}
      <h1 className="sr-only">{t('서울 라이브')}</h1>
      <HomeScreen />
    </main>
  )
}

export default function App() {
  return (
    <QueryProvider>
      <LocationProvider>
        {/* 애니메이션 프로바이더는 여기 없다. 애니메이션을 쓰는 화면이 스스로
            들고 있다 — 근거는 `app/MotionProvider.tsx`(요약: `m.*`가
            `LazyMotion` 없이 렌더되면 `initial` 스타일에 얼어붙어 내용이
            통째로 안 보인다). */}
        <AppShell />
      </LocationProvider>
    </QueryProvider>
  )
}
