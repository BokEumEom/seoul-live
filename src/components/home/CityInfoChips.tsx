import { useCityInfo } from '../../data/queries'
import { cityInfoSectionDomId, summarizeCityInfo } from '../../domain/cityInfoSummary'

interface Props {
  readonly areaName: string
}

// 상세 맨 위의 요약 칩 한 줄. 샘플(서울 인파레이더)의
// 「주차 45% · 정체 · 행사 12 · 따릉이 131대」 자리다.
//
// **추가 호출이 0이다.** 도시 정보가 상세를 열 때 자동으로 조회되므로
// (`CityInfoPanel` 주석 참고) 이 줄은 이미 받아 둔 응답을 다시 세기만 한다.
// `useCityInfo`를 여기서 한 번 더 부르지만 같은 queryKey라 캐시를 나눠 쓴다.
//
// **누르면 그 절로 간다 — 샘플에는 없는 것이다.** 도시 정보가 통째로 펼쳐지면서
// 상세가 매우 길어졌는데, 칩이 요약만 하고 끝나면 사용자는 그 값을 확인하러
// 손으로 한참 스크롤해야 한다. 샘플은 4,000px짜리 한 장을 그냥 스크롤하게 두지만
// 우리는 시트 안이라 더 좁다.
//
// **로딩 자리를 비워 두는 것은 고른 것이다.** 스켈레톤을 넣으면 혼잡도 카드가
// 이미 떠 있는 화면에서 그 위 한 줄만 회색으로 깜빡인다 — 값이 없다가 생기는
// 편이 낫다. 자리도 미리 잡아두지 않는다: 도시 정보가 하나도 없는 명소에서는
// 이 줄이 영영 안 오므로 빈 띠가 남는다.
export function CityInfoChips({ areaName }: Props) {
  const cityInfo = useCityInfo(areaName)
  const info = cityInfo.data

  if (info === undefined) {
    return null
  }

  const chips = summarizeCityInfo(info)
  if (chips.length === 0) {
    return null
  }

  return (
    // 가로 스크롤이다. 칩 다섯 개가 390px에 다 안 들어가는 명소가 있고,
    // 줄바꿈으로 두 줄이 되면 그 아래 카드가 명소마다 다른 높이에서 시작한다.
    // `-mx-4 px-4`는 스크롤 끝이 화면 가장자리에 닿게 하려는 것이다 — 안 하면
    // 마지막 칩이 여백 앞에서 잘려 「더 있다」는 신호가 약해진다.
    <div className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        {chips.map((chip) => (
          <li key={chip.sectionId}>
            <button
              type="button"
              onClick={() => {
                scrollToSection(cityInfoSectionDomId(chip.sectionId))
              }}
              className="min-h-9 rounded-full border border-outline-variant bg-surface-container-lowest px-3 text-label-md whitespace-nowrap text-on-surface-variant"
            >
              {chip.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 절 위에 남기는 숨쉴 틈. 카드가 시트 맨 위에 딱 붙으면 잘린 것처럼 보인다. */
const SCROLL_GAP_PX = 8

/**
 * 그 절로 **시트만** 스크롤하고 포커스도 함께 옮긴다.
 *
 * `<a href="#id">`를 쓰지 않는 이유는 주소창이다. 미니앱은 주소를 사용자에게
 * 안 보여주지만 해시는 히스토리에 쌓여, 뒤로가기가 「앞 절로 돌아가기」가 된다.
 *
 * **`scrollIntoView`도 쓰지 않는다. 이게 진짜 이유다.** 그 함수는 스크롤 가능한
 * **조상을 전부 거슬러 올라가며** 스크롤한다. 홈 화면 루트(`relative size-full`)가
 * 스크롤 가능한 상태라 함께 524px 밀렸고, **지도가 화면 밖으로 사라졌다**
 * (390×844 실측). 시트 안의 절로 가려던 조작이 화면 절반을 날린 것이다.
 * 그래서 스크롤할 상자를 직접 지목한다 — 시트 내용 상자 하나만 움직인다.
 *
 * 포커스를 같이 옮기지 않으면 키보드·스크린리더 사용자는 화면만 움직이고
 * 제자리에 남는다 — 다음 탭이 칩 줄의 다음 칩으로 가버린다. `preventScroll`은
 * 브라우저가 포커스를 이유로 위 조상들을 다시 스크롤하는 것을 막는다.
 *
 * **부드러운 스크롤을 여기서 판단한다.** `index.css`의 `prefers-reduced-motion`
 * 블록은 CSS의 `scroll-behavior`를 끄지만, JS로 `behavior: 'smooth'`를 직접
 * 넘기면 그 규칙을 지나쳐 버린다.
 */
function scrollToSection(domId: string): void {
  const target = document.getElementById(domId)
  if (target === null) {
    return
  }

  // `data-sheet-content`는 시트가 지키기로 한 계약이다(`BottomSheet` 주석).
  const box = target.closest('[data-sheet-content]')
  if (box instanceof HTMLElement) {
    const offset = target.getBoundingClientRect().top - box.getBoundingClientRect().top
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.scrollTo({
      top: box.scrollTop + offset - SCROLL_GAP_PX,
      behavior: still ? 'auto' : 'smooth',
    })
  }

  target.focus({ preventScroll: true })
}
