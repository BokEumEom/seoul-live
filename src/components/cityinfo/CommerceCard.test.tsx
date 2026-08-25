import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Commerce, CommerceCategory } from '../../domain/commerce'
import { TONE_CLASS, TONE_TEXT_CLASS } from '../common/toneClass'
import { CommerceCard } from './CommerceCard'

function category(overrides: Partial<CommerceCategory> = {}): CommerceCategory {
  return {
    major: '음식·음료',
    minor: '한식',
    level: '바쁜',
    paymentCount: 57,
    paymentMin: 1_300_000,
    paymentMax: 1_400_000,
    storeCount: 374,
    storeCountAt: '202607',
    ...overrides,
  }
}

function commerce(overrides: Partial<Commerce> = {}): Commerce {
  return {
    level: '바쁜',
    paymentCount: 168,
    paymentMin: 390_000_000,
    paymentMax: 400_000_000,
    categories: [],
    maleRate: 41.4,
    femaleRate: 58.6,
    ageRates: [0, 10.4, 12.8, 26.2, 26.8, 23.8],
    personalRate: 79.4,
    corporationRate: 20.6,
    updatedAt: '20260825 1120',
    ...overrides,
  }
}

describe('CommerceCard', () => {
  it('지역 지표를 문장으로 적고 톤을 붙인다', () => {
    render(<CommerceCard commerce={commerce()} />)

    const headline = screen.getByText('지금 이 동네 상권은 바쁜편이에요')
    expect(headline).toHaveClass(TONE_TEXT_CLASS.crowded)
  })

  // 명세에 값 목록이 없다. 표에 없는 값에 아무 톤이나 붙이면 **틀린 색**이 된다.
  it('모르는 지표에는 색을 안 붙인다', () => {
    render(<CommerceCard commerce={commerce({ level: '북적이는' })} />)

    const headline = screen.getByText('지금 이 동네 상권은 북적이는편이에요')
    for (const className of Object.values(TONE_TEXT_CLASS)) {
      expect(headline).not.toHaveClass(className)
    }
  })

  // **금액은 최소값을 쓴다.** 구간을 그대로 적으면 줄이 두 배로 길어지는데
  // 이 값이 답하는 것은 「대략 얼마나 도나」다 — 최소값이면 넘겨 말하지 않는다.
  //
  // **2026-08-25에 한 줄에서 두 칸으로 갈렸다**(시안 `_8`). 이 둘은 규모를
  // 말하는 머릿수치라 본문 크기로 적으면 아래 업종 목록의 글자와 구별이 안 된다.
  it('결제 건수와 금액을 저마다의 칸에 크게 적는다', () => {
    render(<CommerceCard commerce={commerce()} />)

    expect(screen.getByText('결제 건수')).toBeInTheDocument()
    expect(screen.getByText('168')).toHaveClass('text-display-lg')
    expect(screen.getByText('결제 금액')).toBeInTheDocument()
    expect(screen.getByText('3.9억')).toHaveClass('text-display-lg')
    // 최대값(4.0억)은 안 적는다.
    expect(screen.queryByText(/4억/)).not.toBeInTheDocument()
  })

  // 두 값 중 하나만 오는 응답이 있다. 남은 하나가 격자를 혼자 쓰면 된다 —
  // 빈 칸을 그리면 「금액이 0원」으로 읽힌다.
  it('금액을 못 읽으면 건수 칸만 남는다', () => {
    render(<CommerceCard commerce={commerce({ paymentMin: null })} />)

    expect(screen.getByText('결제 건수')).toBeInTheDocument()
    expect(screen.queryByText('결제 금액')).toBeNull()
  })

  it('업종을 결제 많은 순으로 여섯 줄까지 보여준다', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      category({ minor: `업종${index}`, paymentCount: index }),
    )
    render(<CommerceCard commerce={commerce({ categories: many })} />)

    // 「누가 쓰고 있나」의 연령 줄도 `listitem`이라 업종 목록만 골라 센다.
    const rows = within(
      screen.getByRole('list', { name: '업종별' }),
    ).getAllByRole('listitem')
    expect(rows).toHaveLength(6)
    expect(within(rows[0]).getByText('업종7')).toBeInTheDocument()
    expect(screen.queryByText('업종0')).not.toBeInTheDocument()
    expect(screen.getByText('외 2종')).toBeInTheDocument()
  })

  // 중분류가 본체다 — 「음식·음료」만으로는 카페인지 식당인지 모른다.
  it('업종 줄이 중분류를 앞세우고 대분류·가맹점 수를 함께 적는다', () => {
    render(<CommerceCard commerce={commerce({ categories: [category()] })} />)

    expect(screen.getByText('한식')).toBeInTheDocument()
    expect(screen.getByText(/음식·음료/)).toBeInTheDocument()
    expect(screen.getByText(/가맹점 374곳/)).toBeInTheDocument()
  })

  it('업종 지표에 톤 배지가 붙는다', () => {
    render(
      <CommerceCard commerce={commerce({ categories: [category({ level: '한산한' })] })} />,
    )

    expect(screen.getByText('한산한')).toHaveClass(TONE_CLASS.calm)
  })

  // **인구 탭과 같은 막대를 쓴다**(2026-08-25). 연령은 줄로 펴고 성별·개인법인은
  // 양 끝에 이름을 두는 두 칸 막대다 — 시안 `_8`의 「누가 많이 이용하고
  // 있나요?」가 `_3`의 인구 구성과 같은 모양이다.
  it('연령대는 줄로 펴서 값마다 이름과 비율을 적는다', () => {
    render(<CommerceCard commerce={commerce()} />)
    const rows = within(
      screen.getByRole('list', { name: '연령대별 소비 비율' }),
    ).getAllByRole('listitem')

    // 0인 「10대 이하」는 줄을 만들지 않는다.
    expect(rows).toHaveLength(5)
    expect(within(rows[2]).getByText('40대')).toBeInTheDocument()
    expect(within(rows[2]).getByText('26%')).toBeInTheDocument()
  })

  /**
   * **이름과 값이 짝을 지켜야 한다.** 두 칸 막대는 왼쪽·오른쪽에 값을 따로
   * 넘기는 모양이라 자리를 바꿔 넘겨도 화면이 멀쩡해 보인다 — 「남성 59% ·
   * 41% 여성」은 그럴듯하고 **틀렸다**. 2026-08-25 변이 실험에서 실제로
   * 살아남았다.
   */
  it('성별과 개인·법인은 두 칸 막대로 그리고 이름과 값이 짝을 지킨다', () => {
    render(<CommerceCard commerce={commerce()} />)

    expect(screen.getByRole('img', { name: /성별 소비 비율/ })).toHaveAccessibleName(
      '성별 소비 비율: 남성 41%, 여성 59%',
    )
    expect(screen.getByRole('img', { name: /개인·법인 소비 비율/ })).toHaveAccessibleName(
      '개인·법인 소비 비율: 개인 79%, 법인 21%',
    )
  })

  // **옛 막대는 10% 미만인 칸의 이름을 아예 안 적었다.** 화면에는 색만 남고
  // 「법인 5%」가 어디에도 없었다 — 작은 값은 작게 그리면 되지 지울 이유가 없다.
  it('작은 쪽도 글자로 적는다', () => {
    render(<CommerceCard commerce={commerce({ personalRate: 95, corporationRate: 5 })} />)

    expect(screen.getByText('법인')).toBeInTheDocument()
    expect(screen.getByText('5%')).toBeInTheDocument()
  })

  it('비율이 전부 0이면 막대를 안 그린다', () => {
    render(
      <CommerceCard
        commerce={commerce({
          ageRates: [0, 0, 0, 0, 0, 0],
          maleRate: 0,
          femaleRate: 0,
          personalRate: 0,
          corporationRate: 0,
        })}
      />,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '연령대별 소비 비율' })).toBeNull()
  })
})
