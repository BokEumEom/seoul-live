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

/**
 * 그 절로 화면을 옮기고 **포커스도 함께 옮긴다.**
 *
 * `<a href="#id">`를 쓰지 않는 이유는 주소창이다. 미니앱은 주소를 사용자에게
 * 안 보여주지만 해시는 히스토리에 쌓여, 뒤로가기가 「앞 절로 돌아가기」가 된다.
 *
 * 포커스를 같이 옮기지 않으면 키보드·스크린리더 사용자는 화면만 움직이고
 * 제자리에 남는다 — 다음 탭이 칩 줄의 다음 칩으로 가버린다.
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
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  // 스크롤을 브라우저가 맡았으니 포커스는 그것을 되돌리지 않게 조용히 옮긴다.
  target.focus({ preventScroll: true })
}
