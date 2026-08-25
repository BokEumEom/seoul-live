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
    residentRate: 29,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
    ...overrides,
  }
}

const NO_AGES: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0]

// 막대는 글자가 없는 빈 span이다. 차트의 자식으로 센다 — 세려고 붙인 속성을
// 따로 두지 않는다.
function bars(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="img"] > span')]
}

function widths(container: HTMLElement): readonly string[] {
  return bars(container).map((bar) => bar.style.width)
}

describe('PopulationCard', () => {
  it('남녀 비율을 보여준다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText(/남 48%/)).toBeInTheDocument()
    expect(screen.getByText(/여 52%/)).toBeInTheDocument()
  })

  // rate()는 칸마다 따로 0을 떨어뜨린다. 한쪽만 못 읽는 게 둘 다 못 읽는
  // 것보다 흔한데, ||로 세면 「남 48% · 여 0%」를 사실로 적는다.
  it('성별 한쪽만 읽혔으면 남녀 칩을 그리지 않는다', () => {
    render(<PopulationCard composition={composition({ femaleRate: 0 })} />)
    expect(screen.queryByText(/남 48%/)).toBeNull()
    expect(screen.queryByText(/여 0%/)).toBeNull()
    // 비상주 칩과 외지인 칩만 남는다.
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('비상주가 많으면 외지인이 많다고 말한다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText('외지인이 많아요')).toBeInTheDocument()
  })

  it('비상주가 적으면 동네 생활권이라고 말한다', () => {
    render(<PopulationCard composition={composition({ nonResidentRate: 22 })} />)
    expect(screen.getByText('동네 생활권이에요')).toBeInTheDocument()
  })

  it('거주 구성을 둘 다 못 읽으면 아무 말도 하지 않는다', () => {
    // rate()가 못 읽은 값을 0으로 떨어뜨린다. 못 읽은 0으로 장소를 단정하지
    // 않는다 — residentLabel이 null을 주고 JSX는 아무것도 그리지 않는다.
    //
    // **둘 다 0이어야 「못 읽음」이다**(2026-08-25). 비상주 하나만 0인 것은
    // 상주 100%라는 뜻이라 실재하는 상태이고, 그때는 말을 한다 — 바로 아래.
    render(
      <PopulationCard composition={composition({ nonResidentRate: 0, residentRate: 0 })} />,
    )
    expect(screen.queryByText('동네 생활권이에요')).toBeNull()
    expect(screen.queryByText('외지인이 많아요')).toBeNull()
    // 칸 수까지 센다. 위 두 단언만으로는 null을 알약 안에 그대로 넣는 구현도
    // 통과하는데, 그러면 글자 없는 빈 알약이 남는다. 남는 건 남녀 칩 하나뿐이다.
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('상주만 읽힌 곳은 동네 생활권이라고 말한다', () => {
    render(
      <PopulationCard composition={composition({ nonResidentRate: 0, residentRate: 100 })} />,
    )
    expect(screen.getByText('동네 생활권이에요')).toBeInTheDocument()
  })

  // 임계값을 경계에서 잠근다. 이게 없으면 >= 를 > 로 바꿔도, 10을 5로 바꿔도
  // 통과한다 — 픽스처에 정확히 10인 값도, 5~9인 값도 없기 때문이다.
  it('정확히 10%면 적고 9%면 적지 않는다', () => {
    render(
      <PopulationCard composition={composition({ ageRates: [0, 0, 10, 9, 0, 0, 0, 0] })} />,
    )
    expect(screen.getByText('20대')).toBeInTheDocument()
    expect(screen.queryByText('30대')).toBeNull()
  })

  // 굵기를 잠근다. --text-label-sm--font-weight가 이미 600이라 font-semibold로
  // 되돌리면 옆 숫자와 무게가 같아져 강조가 사라지는데, 주석은 그 되돌림을
  // 막지 못한다.
  it('연령대 이름을 옆 숫자보다 굵게 적는다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText('20대')).toHaveClass('font-bold')
  })

  // 차트의 aria-label이 같은 값을 이미 읽어준다. <b>는 기본 설정에서 아무것도
  // 알리지 않으므로, 이 줄이 트리에 남으면 표지 없는 부분집합이 한 번 더 낭독된다.
  it('시각 전용 라벨 줄을 접근성 트리에서 뺀다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText('20대').closest('p')).toHaveAttribute('aria-hidden', 'true')
  })

  // 성별·비상주는 읽혔는데 연령대만 통째로 못 읽은 경우다. 0폭 8칸도 균등 8칸과
  // 같은 거짓말을 한다 — 빈 알약 모양의 막대와 아무것도 안 읽는 차트가 남는다.
  it('연령대를 하나도 못 읽었으면 막대를 그리지 않는다', () => {
    const { container } = render(
      <PopulationCard composition={composition({ ageRates: NO_AGES })} />,
    )
    expect(bars(container)).toHaveLength(0)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('읽을 수 있는 값이 하나도 없으면 아무것도 그리지 않는다', () => {
    // 키는 왔는데 내용이 쓰레기인 경우다. 제목만 남기면 죽은 공간과 "목록,
    // 항목 0개"만 남는다 — 사용자에게 "키가 안 왔다"와 구분할 이유가 없는
    // 같은 상태(알 수 있는 게 없다)라 카드가 스스로 빠진다.
    const { container } = render(
      <PopulationCard
        composition={composition({
          maleRate: 0,
          femaleRate: 0,
          // **둘 다 0이어야 「못 읽음」이다**(2026-08-25). 상주 비율을 함께
          // 읽게 되면서 비상주 0 하나로는 판정이 안 선다 — 상주 100·비상주 0인
          // 곳은 실재하는 「동네 생활권」이라 이제 말을 한다.
          nonResidentRate: 0,
          residentRate: 0,
          ageRates: NO_AGES,
        })}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  // 성별이 한쪽만 읽힌 것도 "그릴 수 있는 값"이 아니다. hasReadableComposition이
  // 성별을 ||로 세면 이 구성에서 제목만 뜬다.
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

  // 연령대만 읽힌 구성이다. 목록을 늘 그리면 항목 0개짜리 <ul>이 남는다.
  it('칩이 하나도 없으면 빈 목록을 남기지 않는다', () => {
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
    expect(screen.queryByRole('list')).toBeNull()
  })

  // 못 읽은 칸을 남은 칸으로 채워 넣지 않는다. 실제 합으로 정규화하면 절반만
  // 읽힌 구성에서 막대는 "10대와 30대가 전부"라고 그리는데 바로 아래 글자는
  // "25%, 15%"라고 적어 두 줄이 모순된다. 분모는 최소 100이다.
  //
  // 폭을 자리와 짝지어 단언한다. 칸 개수만 세면 큰 값부터 정렬하거나 뒤집어
  // 그리는 구현도 통과한다.
  it('못 읽은 칸의 빈자리를 남기고 연령대와 짝을 맞춘다', () => {
    const { container } = render(
      <PopulationCard composition={composition({ ageRates: [0, 25, 0, 15, 0, 0, 0, 0] })} />,
    )
    expect(widths(container)).toEqual([
      '0%',
      '25%',
      '0%',
      '15%',
      '0%',
      '0%',
      '0%',
      '0%',
    ])
  })

  // 분모가 100 고정이면 합이 100을 넘는 응답에서 폭 합계가 100%를 넘어 막대가
  // 잘린다. 명세상 합이 100이라는 보장이 없다(domain/composition.ts 주석).
  // 이 단언은 화면에 드러나지 않는 계산을 잠근다 — flex 기본 shrink가 폭 합이
  // 넘칠 때 비례 압축해서, 분모를 100으로 고정해도 픽셀은 같다(브라우저로 확인).
  // 그래도 남기는 이유는 막대에 shrink-0이 붙는 순간 이 분기만이 넘침을 막기
  // 때문이다. 분모 고정 변이가 실제로 이 테스트를 죽인다.
  it('합이 100을 넘으면 실제 합으로 나눈다', () => {
    const { container } = render(
      <PopulationCard composition={composition({ ageRates: [40, 40, 40, 40, 0, 0, 0, 0] })} />,
    )
    expect(widths(container).slice(0, 4)).toEqual(['25%', '25%', '25%', '25%'])
  })

  // jsdom은 WebKit의 list-style:none 시맨틱 제거를 모형화하지 않는다. 실기기
  // 동작을 재현할 수 없으니 결정 자체를 잠근다 — font-bold와 같은 이유다.
  it('목록 시맨틱을 명시한다', () => {
    const { container } = render(<PopulationCard composition={composition()} />)
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list')
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
      expect(bar).toHaveClass(/^bg-/)
    }
  })

  // 막대 여덟 칸은 글자가 없는 빈 칸이라 스크린리더에 아무것도 남지 않는다.
  // 아래 텍스트 라벨은 임계값 미만을 빼므로, 이름이 없으면 작은 연령대는
  // 화면에도 소리에도 안 나온다 — 보는 사람만 분포를 알게 된다.
  //
  // ForecastChart도 role="img"라 Task 8에서 한 트리에 들어간다. 이름으로 좁힌다.
  it('막대 차트가 읽은 칸을 모두 이름으로 읽어준다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByRole('img', { name: /연령대 비율/ })).toHaveAccessibleName(
      '연령대 비율: 0~9세 3%, 10대 8%, 20대 31%, 30대 22%, 40대 14%, 50대 11%, 60대 6%, 70대+ 4%',
    )
  })

  // 0은 "실제로 0%"가 아니라 "못 읽음"일 수 있다. 화면은 그 칸을 아무 말 없이
  // 비우는데 이름만 "0%"라고 여섯 번 단정하면 카드가 지키는 규칙이 소리
  // 채널에서만 깨진다.
  it('못 읽은 칸을 0%라고 읽어주지 않는다', () => {
    render(
      <PopulationCard composition={composition({ ageRates: [0, 25, 0, 15, 0, 0, 0, 0] })} />,
    )
    expect(screen.getByRole('img', { name: /연령대 비율/ })).toHaveAccessibleName(
      '연령대 비율: 10대 25%, 30대 15%',
    )
  })
})
