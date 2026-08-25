import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PopulationComposition } from '../../domain/composition'
import { PopulationCard } from './PopulationCard'

function composition(
  overrides: Partial<PopulationComposition> = {},
): PopulationComposition {
  return {
    maleRate: 48,
    femaleRate: 52,
    nonResidentRate: 71,
    residentRate: 29,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
    ...overrides,
  }
}

const NO_AGES: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0]

function cardTitles(): readonly string[] {
  return screen.getAllByRole('heading').map((heading) => heading.textContent ?? '')
}

describe('PopulationCard', () => {
  // 시안 `_3`은 성별·연령 둘인데 서울 API가 거주 비율을 하나 더 준다.
  it('시안의 두 카드에 거주 비율을 더해 셋을 세운다', () => {
    render(<PopulationCard composition={composition()} />)

    expect(cardTitles()).toEqual(['성별 비율', '연령대별 비율', '거주 비율'])
  })

  it('남녀 비율을 막대로 보여준다', () => {
    render(<PopulationCard composition={composition()} />)

    expect(screen.getByRole('img', { name: /성별 비율/ })).toHaveAccessibleName(
      '성별 비율: 남성 48%, 여성 52%',
    )
  })

  // rate()는 칸마다 따로 0을 떨어뜨린다. 한쪽만 못 읽는 게 둘 다 못 읽는
  // 것보다 흔한데, ||로 세면 「남성 48% · 여성 0%」를 사실로 적는다.
  it('성별 한쪽만 읽혔으면 성별 카드를 그리지 않는다', () => {
    render(<PopulationCard composition={composition({ femaleRate: 0 })} />)

    expect(cardTitles()).toEqual(['연령대별 비율', '거주 비율'])
  })

  it('거주 비율을 막대로 보여준다', () => {
    render(<PopulationCard composition={composition()} />)

    expect(screen.getByRole('img', { name: /거주 비율/ })).toHaveAccessibleName(
      '거주 비율: 상주 29%, 비상주 71%',
    )
  })

  it('비상주가 많으면 외지인이 많다고 말한다', () => {
    render(<PopulationCard composition={composition()} />)

    expect(screen.getByText('외지인이 많아요')).toBeInTheDocument()
  })

  it('비상주가 적으면 동네 생활권이라고 말한다', () => {
    render(
      <PopulationCard composition={composition({ nonResidentRate: 22, residentRate: 78 })} />,
    )

    expect(screen.getByText('동네 생활권이에요')).toBeInTheDocument()
  })

  // **둘 다 0이어야 「못 읽음」이다**(2026-08-25). 비상주 하나만 0인 것은 상주
  // 100%라는 뜻이라 실재하는 상태이고, 그때는 말을 한다 — 바로 아래.
  it('거주 구성을 둘 다 못 읽으면 그 카드가 없다', () => {
    render(
      <PopulationCard composition={composition({ nonResidentRate: 0, residentRate: 0 })} />,
    )

    expect(cardTitles()).toEqual(['성별 비율', '연령대별 비율'])
    expect(screen.queryByText('동네 생활권이에요')).toBeNull()
    expect(screen.queryByText('외지인이 많아요')).toBeNull()
  })

  it('상주만 읽힌 곳은 동네 생활권이라고 말한다', () => {
    render(
      <PopulationCard composition={composition({ nonResidentRate: 0, residentRate: 100 })} />,
    )

    expect(screen.getByText('동네 생활권이에요')).toBeInTheDocument()
  })

  // 0폭 여덟 줄은 「모든 연령대가 0명」이라는 없는 사실을 그린다.
  it('연령대를 하나도 못 읽었으면 그 카드가 없다', () => {
    render(<PopulationCard composition={composition({ ageRates: NO_AGES })} />)

    expect(cardTitles()).toEqual(['성별 비율', '거주 비율'])
  })

  it('읽을 수 있는 값이 하나도 없으면 아무것도 그리지 않는다', () => {
    // 키는 왔는데 내용이 쓰레기인 경우다. 제목만 남기면 죽은 공간이 남는다 —
    // 사용자에게 "키가 안 왔다"와 구분할 이유가 없는 같은 상태다.
    const { container } = render(
      <PopulationCard
        composition={composition({
          maleRate: 0,
          femaleRate: 0,
          nonResidentRate: 0,
          residentRate: 0,
          ageRates: NO_AGES,
        })}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // 성별이 한쪽만 읽힌 것도 "그릴 수 있는 값"이 아니다. hasReadableComposition이
  // 성별을 ||로 세면 이 구성에서 카드 껍데기만 뜬다.
  it('남자만 읽히고 나머지가 0이면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <PopulationCard
        composition={composition({
          femaleRate: 0,
          nonResidentRate: 0,
          residentRate: 0,
          ageRates: NO_AGES,
        })}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // 연령대만 읽힌 구성이다. 카드 껍데기를 늘 그리면 빈 카드 둘이 남는다.
  it('연령대만 읽혔으면 그 카드 하나만 남는다', () => {
    render(
      <PopulationCard
        composition={composition({
          maleRate: 0,
          femaleRate: 0,
          nonResidentRate: 0,
          residentRate: 0,
        })}
      />,
    )

    expect(cardTitles()).toEqual(['연령대별 비율'])
  })
})
