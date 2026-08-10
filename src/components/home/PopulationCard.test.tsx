import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AGE_LABELS } from '../../domain/composition'
import type { PopulationComposition } from '../../domain/composition'
import { PopulationCard } from './PopulationCard'

function composition(
  overrides: Partial<PopulationComposition> = {},
): PopulationComposition {
  return {
    maleRate: 48,
    femaleRate: 52,
    nonResidentRate: 71,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
    ...overrides,
  }
}

// 막대에는 글자가 없다. 세는 방법이 data-age뿐이라 이 속성이 있다.
function bars(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-age]')]
}

describe('PopulationCard', () => {
  it('남녀 비율을 보여준다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText(/남 48%/)).toBeInTheDocument()
    expect(screen.getByText(/여 52%/)).toBeInTheDocument()
  })

  it('비상주가 많으면 외지인이 많다고 말한다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText('외지인이 많아요')).toBeInTheDocument()
  })

  it('비상주가 적으면 동네 생활권이라고 말한다', () => {
    render(<PopulationCard composition={composition({ nonResidentRate: 22 })} />)
    expect(screen.getByText('동네 생활권이에요')).toBeInTheDocument()
  })

  it('비상주가 0이면 아무 말도 하지 않는다', () => {
    // rate()가 못 읽은 값을 0으로 떨어뜨린다. 못 읽은 0으로 장소를 단정하지
    // 않는다 — residentLabel이 null을 주고 JSX는 아무것도 그리지 않는다.
    render(<PopulationCard composition={composition({ nonResidentRate: 0 })} />)
    expect(screen.queryByText('동네 생활권이에요')).toBeNull()
    expect(screen.queryByText('외지인이 많아요')).toBeNull()
    // 칸 수까지 센다. 위 두 단언만으로는 null을 알약 안에 그대로 넣는 구현도
    // 통과하는데, 그러면 글자 없는 빈 알약이 남는다. 남는 건 남녀 칩 하나뿐이다.
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('비중이 큰 연령대만 라벨로 적는다', () => {
    // 여덟 칸을 다 적으면 좁은 시트에서 두 줄을 먹는다.
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText(/20대/)).toBeInTheDocument()
    expect(screen.queryByText(/70대\+/)).toBeNull()
  })

  it('연령대 막대가 여덟 칸이고 라벨 순서대로 놓인다', () => {
    // 개수만 세면 칸과 연령대의 짝이 어긋나도 통과한다. 큰 값부터 정렬해
    // 그리는 구현이 그 예다 — 색은 그대로인데 20대 자리에 60대가 온다.
    const { container } = render(<PopulationCard composition={composition()} />)
    expect(bars(container).map((bar) => bar.dataset.age)).toEqual([...AGE_LABELS])
  })

  it('읽지 못해 전부 0이면 칩도 막대도 그리지 않는다', () => {
    // 키는 왔는데 내용이 쓰레기인 경우다. 0을 사실처럼 그리면 없는 인구를
    // 지어낸다 — 균등 8칸 막대는 "연령대가 고르다"는 없는 사실까지 그린다.
    const { container } = render(
      <PopulationCard
        composition={composition({
          maleRate: 0,
          femaleRate: 0,
          nonResidentRate: 0,
          ageRates: [0, 0, 0, 0, 0, 0, 0, 0],
        })}
      />,
    )
    expect(screen.getByRole('heading', { name: '지금 누가 있나' })).toBeInTheDocument()
    expect(screen.queryByText(/남 0%/)).toBeNull()
    expect(screen.queryByText(/비상주/)).toBeNull()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(bars(container)).toHaveLength(0)
  })

  // 서울 API가 합을 100으로 준다는 보장이 없다(domain/composition.ts 주석).
  // 100으로 나누면 막대가 덜 차서 있지도 않은 여백이 남는다. 픽스처의 합은
  // 99라 이 차이가 0.x%로만 나타나므로 여기서 합 50으로 갈라 둔다.
  //
  // 폭을 연령대와 짝지어 단언한다. 칸 순서만 보면 큰 값부터 정렬해 그리는
  // 구현도 통과하는데(data-age는 정렬 뒤 index로 다시 붙으므로 순서가 그대로다)
  // 그러면 0~9세 자리에 30대의 폭이 온다. 값이 띄엄띄엄한 픽스처라야 갈린다.
  it('합이 100이 아니어도 실제 합으로 폭을 내고 연령대와 짝을 맞춘다', () => {
    const { container } = render(
      <PopulationCard composition={composition({ ageRates: [0, 25, 0, 25, 0, 0, 0, 0] })} />,
    )
    expect(bars(container).map((bar) => [bar.dataset.age, bar.style.width])).toEqual([
      ['0~9세', '0%'],
      ['10대', '50%'],
      ['20대', '0%'],
      ['30대', '50%'],
      ['40대', '0%'],
      ['50대', '0%'],
      ['60대', '0%'],
      ['70대+', '0%'],
    ])
  })

  // 색 배열은 AGE_LABELS와 길이가 묶여 있지 않다. 연령 구간이 아홉 개가 되면
  // 아홉째 칸의 className이 undefined가 되어 조용히 색 없는 막대가 된다.
  // 픽스처를 AGE_LABELS에서 만들어 그 어긋남을 여기서 잡는다.
  it('연령 구간이 늘어도 색이 빠진 칸을 만들지 않는다', () => {
    const { container } = render(
      <PopulationCard composition={composition({ ageRates: AGE_LABELS.map(() => 12) })} />,
    )
    const rendered = bars(container)
    expect(rendered).toHaveLength(AGE_LABELS.length)
    for (const bar of rendered) {
      expect(bar.getAttribute('class')).toMatch(/^bg-\S+$/)
    }
  })

  // 막대 여덟 칸은 글자가 없는 빈 칸이라 스크린리더에 아무것도 남지 않는다.
  // 아래 텍스트 라벨은 임계값 미만을 빼므로, 이름이 없으면 작은 연령대는
  // 화면에도 소리에도 안 나온다 — 보는 사람만 분포를 알게 된다.
  it('막대 차트가 여덟 칸을 모두 이름으로 읽어준다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '연령대 비율: 0~9세 3%, 10대 8%, 20대 31%, 30대 22%, 40대 14%, 50대 11%, 60대 6%, 70대+ 4%',
    )
  })
})
