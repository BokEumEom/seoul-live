import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AGE_LABELS } from '../../domain/composition'
import { AgeShareRows } from './AgeShareRows'

const RATES = [3, 8, 31, 22, 14, 11, 6, 4]

/** 줄마다의 채움 막대. 트랙 안의 span이다. */
function fills(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('li > span > span')]
}

describe('AgeShareRows', () => {
  it('연령대마다 이름과 비율을 한 줄로 적는다', () => {
    render(<AgeShareRows rates={RATES} />)
    const rows = screen.getAllByRole('listitem')

    expect(rows).toHaveLength(AGE_LABELS.length)
    expect(within(rows[2]).getByText('20대')).toBeInTheDocument()
    expect(within(rows[2]).getByText('31%')).toBeInTheDocument()
  })

  // **막대 길이가 곧 백분율이다.** 최댓값에 맞춰 늘리면 1등이 트랙을 꽉 채워
  // 「이 명소는 20대가 전부」로 읽히는데 실제로는 31%다.
  it('막대 길이가 그 값 그대로다', () => {
    const { container } = render(<AgeShareRows rates={RATES} />)

    expect(fills(container).map((fill) => fill.style.width)).toEqual(
      RATES.map((rate) => `${String(rate)}%`),
    )
  })

  // 줄마다 제 트랙을 가지므로 쌓은 막대의 분모 규칙(`shareWidths`)이 여기서는
  // 안 통한다. 트랙 밖으로만 안 나가면 된다.
  it('100을 넘는 값도 트랙 밖으로 안 나간다', () => {
    const { container } = render(<AgeShareRows rates={[130, 0, 0, 0, 0, 0, 0, 0]} />)

    expect(fills(container)[0].style.width).toBe('100%')
  })

  // **0은 「실제로 0%」가 아니라 「읽지 못함」일 수 있다.** 줄을 그리면 화면과
  // 스크린리더가 둘 다 「60대 0%」라고 단정하게 된다.
  it('0인 칸은 줄을 만들지 않는다', () => {
    render(<AgeShareRows rates={[0, 25, 0, 15, 0, 0, 0, 0]} />)
    const rows = screen.getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('10대')).toBeInTheDocument()
    expect(within(rows[1]).getByText('30대')).toBeInTheDocument()
    expect(screen.queryByText('0%')).toBeNull()
  })

  // **거르면서 자리가 밀리면 이름과 값이 어긋난다** — 「20대」 줄에 30대의
  // 비율이 붙는 종류의 버그다. 이름과 값을 한 줄 안에서 짝지어 잰다.
  it('거른 뒤에도 이름과 값이 짝을 지킨다', () => {
    render(<AgeShareRows rates={[0, 0, 0, 0, 40, 0, 0, 12]} />)
    const rows = screen.getAllByRole('listitem')

    expect(within(rows[0]).getByText('40대')).toBeInTheDocument()
    expect(within(rows[0]).getByText('40%')).toBeInTheDocument()
    expect(within(rows[1]).getByText('70대+')).toBeInTheDocument()
    expect(within(rows[1]).getByText('12%')).toBeInTheDocument()
  })

  // 여덟 줄을 훑을 때 눈이 멈출 자리를 하나 준다. 시안 그대로다.
  it('가장 큰 칸의 숫자만 굵다', () => {
    render(<AgeShareRows rates={RATES} />)

    expect(screen.getByText('31%')).toHaveClass('font-bold')
    expect(screen.getByText('22%')).not.toHaveClass('font-bold')
  })

  // **순위로 칠한다.** 자리로 칠하면 50대가 가장 많은 명소에서 20대가 더
  // 진하게 그려진다 — 색이 막대 길이와 다른 말을 하게 된다.
  it('1등이 가장 진하고 꼴찌가 가장 옅다', () => {
    // 50대(6번째 자리)가 가장 크다. 자리로 칠하면 여기서 갈린다.
    const { container } = render(<AgeShareRows rates={[1, 2, 3, 4, 5, 40, 6, 7]} />)
    const rendered = fills(container)

    // 값이 큰 차례: 50대(40) → 70대+(7) → 60대(6) → …
    expect(rendered[5]).toHaveClass('bg-primary')
    expect(rendered[0]).toHaveClass('bg-primary/20')
  })

  // 색 배열은 `AGE_LABELS`와 길이가 묶여 있지 않다. 연령 구간이 아홉 개가 되면
  // 아홉째 칸의 className이 undefined가 되어 조용히 색 없는 막대가 된다.
  it('연령 구간이 늘어도 색이 빠진 칸을 만들지 않는다', () => {
    const { container } = render(
      <AgeShareRows rates={[...AGE_LABELS.map((_, index) => index + 1), 9, 10]} />,
    )
    const rendered = fills(container)

    expect(rendered).toHaveLength(AGE_LABELS.length + 2)
    for (const fill of rendered) {
      expect(fill).toHaveClass(/^bg-/)
    }
  })

  // jsdom은 WebKit의 list-style:none 시맨틱 제거를 모형화하지 않는다. 실기기
  // 동작을 재현할 수 없으니 결정 자체를 잠근다.
  it('목록 시맨틱을 명시한다', () => {
    const { container } = render(<AgeShareRows rates={RATES} />)

    expect(container.querySelector('ul')).toHaveAttribute('role', 'list')
  })

  // 값은 양옆의 글자가 이미 말한다. 트랙에 이름을 또 붙이면 스크린리더가
  // 여덟 줄을 두 번씩 읽는다.
  it('트랙을 접근성 트리에서 뺀다', () => {
    const { container } = render(<AgeShareRows rates={RATES} />)

    for (const track of container.querySelectorAll('li > span:nth-child(2)')) {
      expect(track).toHaveAttribute('aria-hidden', 'true')
    }
  })

  // **반올림이 「0인 칸은 안 그린다」 규칙을 뚫는다.** 실호출의 광화문
  // `PPLTN_RATE_0`가 0.4인데 그대로 반올림하면 사람이 있는 칸을 「0%」라고
  // 적는다 — 헤드리스 화면에서 실제로 그렇게 떴다(2026-08-25).
  it('1% 미만을 0%라고 적지 않는다', () => {
    render(<AgeShareRows rates={[0.4, 8, 31, 22, 14, 11, 6, 4]} />)

    expect(screen.getByText('<1%')).toBeInTheDocument()
    expect(screen.queryByText('0%')).toBeNull()
    // 줄은 남는다 — 「어린이가 거의 없다」가 그 자체로 정보다.
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })
})
