import { setTheme, useResolvedTheme } from '../../hooks/themeStore'
import { Icon } from '../common/Icon'

// 화면 테마를 한 번에 뒤집는 버튼. **서울 인파레이더는 상단바에 둔다** —
// 우리는 상단바를 걷어냈으므로(세로 공간이 가장 귀한 자원이다) 검색 줄
// 오른쪽 끝이 그 자리다. 좁은 화면에서는 지도 위에, 넓은 화면에서는 패널
// 안에 놓이는데 **둘 다 검색 줄과 같은 줄**이라 자리를 새로 먹지 않는다.
//
// **「기기 설정」은 여기 없다.** 세 값을 한 버튼으로 돌리면 누를 때마다 다음이
// 무엇인지 알 수 없고, 아이콘 하나로 세 상태를 그릴 수도 없다. 이 버튼은
// 「지금 반대로」만 하고, 셋 중에 고르는 일은 「오늘의 서울」의 `ThemeSetting`이
// 그대로 맡는다 — 자주 쓰는 조작은 앞에, 드물게 정하는 것은 설정에.
//
// **아이콘이 「지금」이 아니라 「누르면 무엇이 되는지」를 그린다.** 밝을 때
// 달이 보이고 누르면 어두워진다. 상태를 그리는 관용(밝으면 해)과 반대로
// 보이지만, 버튼은 결과를 약속하는 물건이라 이쪽이 덜 헷갈린다 — 접근성
// 이름도 같은 말을 하므로 눈으로 보든 소리로 듣든 어긋나지 않는다.
export function ThemeToggle() {
  const resolved = useResolvedTheme()
  const nextIsDark = resolved === 'light'

  return (
    <button
      type="button"
      aria-label={nextIsDark ? '어두운 화면으로 바꾸기' : '밝은 화면으로 바꾸기'}
      onClick={() => {
        setTheme(nextIsDark ? 'dark' : 'light')
      }}
      // 검색 필드와 같은 높이·모양이라 한 줄로 읽힌다. 지도 위에 떠 있을 때도
      // 배경과 그림자가 있어야 타일 위에서 아이콘이 사라지지 않는다.
      className="grid size-12 shrink-0 place-items-center rounded-card border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-floating"
    >
      <Icon name={nextIsDark ? 'moon' : 'sun'} className="size-5" />
    </button>
  )
}
