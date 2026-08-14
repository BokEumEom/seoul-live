import type { ThemeSetting as Setting } from '../../domain/theme'
import { setTheme, useThemeSetting } from '../../hooks/themeStore'

// 리터럴 배열로 둔다. Tailwind v4는 정적 추출이라 클래스를 조합하지 않는다.
const OPTIONS: readonly { readonly value: Setting; readonly label: string }[] = [
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
  { value: 'system', label: '기기 설정' },
]

// **다크 모드는 지원이지 기본이 아니다.** 예전에는 CSS가
// `prefers-color-scheme`를 직접 봐서 폰이 어두운 사용자에게는 앱이 늘 어두웠다.
// 기본은 밝게이고(`domain/theme.ts`의 `DEFAULT_THEME`), 기기를 따르고 싶은
// 사용자는 여기서 「기기 설정」을 고른다 — 그건 고른 것이므로 기본이 아니다.
//
// **자리를 「오늘의 서울」 맨 아래로 잡은 것은 교환이다.** 이 앱에는 설정
// 화면이 없고, 지도 위 오버레이나 목록 머리에 두면 하루에 한 번 쓸까 말까 한
// 것이 상시로 자리를 먹는다. 대신 눈에 잘 안 띈다 — 실사용에서 「다크 모드가
// 없다」는 말이 나오면 그때 자리를 올리는 것이 맞다.
export function ThemeSetting() {
  const current = useThemeSetting()

  return (
    <section className="mt-6 px-4">
      <h3 className="text-label-md font-semibold text-on-surface-variant">화면 테마</h3>
      {/* 탭이 아니라 버튼 묶음인 근거는 `SortSegmented`·`FilterChips`에 한 벌
          있다. 이름을 함께 붙여야 보조기술이 무엇을 고르는 줄인지 말한다. */}
      <div
        role="group"
        aria-label="화면 테마"
        className="mt-2 flex gap-1 rounded-full bg-surface-container p-1"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={current === option.value}
            onClick={() => {
              setTheme(option.value)
            }}
            className={`min-h-10 flex-1 rounded-full px-3 text-label-md font-semibold ${
              current === option.value
                ? 'bg-surface-container-lowest text-primary shadow-floating'
                : 'text-on-surface-variant'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
