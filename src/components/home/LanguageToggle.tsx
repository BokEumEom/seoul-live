import { setLanguage } from '../../hooks/languageStore'
import { useLanguage } from '../../hooks/languageStore'

/**
 * 언어를 바꾸는 버튼.
 *
 * **묻어 두면 안 된다.** 화면 테마는 설정에 넣어도 되지만 언어는 다르다 —
 * 지금 읽을 수 없는 말로 적힌 메뉴를 헤치고 들어가야 한다면, 정작 그 기능이
 * 필요한 사람은 영영 못 찾는다. 그래서 검색 줄에 상시로 나와 있다.
 *
 * **버튼에 적히는 글자가 「바뀔 언어」다.** 한국어 화면에서는 `EN`이 보이고
 * 누르면 영어가 된다 — 지금 언어를 적으면(한국어 화면에 `한국어`) 무엇을
 * 누르는 것인지 알 수 없다. 테마 토글이 「누르면 무엇이 되는지」를 그리는 것과
 * 같은 규칙이다.
 *
 * 글자를 쓰는 이유: 지구본 아이콘은 「언어」를 뜻하는 관용이지만 **어느 언어로
 * 바뀌는지**를 말하지 못한다. 두 글자면 그것까지 말한다.
 */
export function LanguageToggle() {
  const language = useLanguage()
  const next = language === 'ko' ? 'en' : 'ko'

  return (
    <button
      type="button"
      // 이름은 **바뀔 언어를 그 언어로** 적는다. 영어를 찾는 사람이 한국어
      // 안내를 읽을 수 없으므로, 이름 자체가 목적지를 가리켜야 한다.
      aria-label={next === 'en' ? 'Switch to English' : '한국어로 바꾸기'}
      onClick={() => {
        setLanguage(next)
      }}
      className="grid size-12 shrink-0 place-items-center rounded-card border border-outline-variant bg-surface-container-lowest text-label-md font-semibold text-on-surface-variant shadow-floating"
    >
      {next === 'en' ? 'EN' : '한'}
    </button>
  )
}
