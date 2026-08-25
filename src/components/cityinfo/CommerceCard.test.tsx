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
  it('결제 건수와 금액을 억 단위로 접어 한 줄에 적는다', () => {
    render(<CommerceCard commerce={commerce()} />)

    expect(screen.getByText(/결제 168건/)).toBeInTheDocument()
    expect(screen.getByText(/3\.9억/)).toBeInTheDocument()
    // 최대값(4.0억)은 안 적는다.
    expect(screen.queryByText(/4억/)).not.toBeInTheDocument()
  })

  it('업종을 결제 많은 순으로 여섯 줄까지 보여준다', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      category({ minor: `업종${index}`, paymentCount: index }),
    )
    render(<CommerceCard commerce={commerce({ categories: many })} />)

    const rows = screen.getAllByRole('listitem')
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

  it('연령·성별·개인법인 막대를 그린다', () => {
    render(<CommerceCard commerce={commerce()} />)

    expect(screen.getByRole('img', { name: /연령대별 소비 비율/ })).toHaveAccessibleName(
      expect.stringContaining('40대 26%'),
    )
    expect(screen.getByRole('img', { name: /성별 소비 비율/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /개인·법인 소비 비율/ })).toBeInTheDocument()
  })

  // 남녀·개인법인은 칸이 둘뿐이라 10% 문턱을 두면 한쪽이 통째로 사라진다.
  it('두 칸짜리 막대는 작은 쪽도 글자로 적는다', () => {
    render(<CommerceCard commerce={commerce({ personalRate: 95, corporationRate: 5 })} />)

    expect(screen.getByText('법인')).toBeInTheDocument()
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
  })
})
