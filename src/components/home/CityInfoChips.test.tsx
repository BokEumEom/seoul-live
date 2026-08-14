import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../../domain/cityInfo'
import { CityInfoChips } from './CityInfoChips'

vi.mock('../../data/queries', () => ({ useCityInfo: vi.fn() }))

const queries = await import('../../data/queries')
const useCityInfo = vi.mocked(queries.useCityInfo)

const EMPTY: CityInfo = {
  areaName: '광화문·덕수궁',
  areaCode: 'POI009',
  weather: null,
  roadTraffic: null,
  accidents: [],
  parking: [],
  bikes: [],
  events: [],
  alerts: [],
  subway: [],
}

function ok(info: CityInfo): UseQueryResult<CityInfo> {
  return { data: info, isPending: false, isError: false } as UseQueryResult<CityInfo>
}

/**
 * 시트 안에 놓고 그린다. 칩이 스크롤할 상자를 `data-sheet-content`로 찾으므로,
 * 그 상자가 없으면 **이 파일이 검증하려는 동작 자체가 안 일어난다.**
 */
function renderInSheet(info: CityInfo): HTMLElement {
  useCityInfo.mockReturnValue(ok(info))
  const { container } = render(
    <div data-sheet-content>
      <CityInfoChips areaName="광화문·덕수궁" />
      <section id="cityinfo-parking">주차장</section>
    </div>,
  )
  return container.querySelector('[data-sheet-content]') as HTMLElement
}

const WITH_PARKING: CityInfo = {
  ...EMPTY,
  parking: [
    { name: '주차장', coords: null, capacity: 100, available: 45, liveAvailable: true, paid: null },
  ],
}

beforeEach(() => {
  useCityInfo.mockReset()
})

describe('CityInfoChips', () => {
  it('시트 상자 하나만 스크롤한다', async () => {
    // **`scrollIntoView`를 쓰면 안 된다.** 그 함수는 스크롤 가능한 조상을
    // 전부 거슬러 올라가며 스크롤한다. 홈 화면 루트가 함께 524px 밀려
    // 지도가 화면 밖으로 사라졌다(390×844 실측). 여기서 잡는 것은
    // 「어느 상자를 움직였나」다 — 얼마나 움직였는지는 jsdom에 레이아웃이
    // 없어 못 잰다.
    const box = renderInSheet(WITH_PARKING)
    const scrollTo = vi.fn()
    box.scrollTo = scrollTo
    const intoView = vi.spyOn(Element.prototype, 'scrollIntoView')

    await userEvent.click(screen.getByRole('button', { name: '주차 45%' }))

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(intoView).not.toHaveBeenCalled()
    intoView.mockRestore()
  })

  it('움직이지 말라는 설정이면 부드럽게 굴리지 않는다', async () => {
    // `index.css`의 `prefers-reduced-motion` 블록은 CSS의 `scroll-behavior`만
    // 끈다. JS로 `behavior: 'smooth'`를 직접 넘기면 그 규칙을 지나쳐 버리므로
    // 여기서 한 번 더 판단해야 한다.
    const box = renderInSheet(WITH_PARKING)
    const scrollTo = vi.fn()
    box.scrollTo = scrollTo
    window.matchMedia = ((query: string) =>
      ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia

    await userEvent.click(screen.getByRole('button', { name: '주차 45%' }))

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('아직 도시 정보가 없으면 아무것도 그리지 않는다', () => {
    // 스켈레톤을 넣으면 혼잡도 카드가 이미 떠 있는 화면에서 그 위 한 줄만
    // 회색으로 깜빡인다 — 값이 없다가 생기는 편이 낫다.
    useCityInfo.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as UseQueryResult<CityInfo>)
    const { container } = render(<CityInfoChips areaName="광화문·덕수궁" />)

    expect(container).toBeEmptyDOMElement()
  })
})
