import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SplitShareBar } from './SplitShareBar'

function widths(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll<HTMLElement>('[role="img"] > span')].map(
    (part) => part.style.width,
  )
}

function render48to52() {
  return render(
    <SplitShareBar
      leftLabel="남성"
      leftValue={48}
      rightLabel="여성"
      rightValue={52}
      title="성별 비율"
    />,
  )
}

describe('SplitShareBar', () => {
  it('양쪽 끝에 이름과 값을 적는다', () => {
    render48to52()

    expect(screen.getByText('남성')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText('여성')).toBeInTheDocument()
    expect(screen.getByText('52%')).toBeInTheDocument()
  })

  it('막대 폭이 두 값을 따른다', () => {
    const { container } = render48to52()

    expect(widths(container)).toEqual(['48%', '52%'])
  })

  // 막대에는 글자가 없어 스크린리더에 아무것도 안 남는다. 이름이 없으면
  // 「무엇의 비율인가」가 소리 채널에서만 사라진다.
  it('막대가 제 이름을 갖는다', () => {
    render48to52()

    expect(screen.getByRole('img', { name: /성별 비율/ })).toHaveAccessibleName(
      '성별 비율: 남성 48%, 여성 52%',
    )
  })

  // **분모가 최소 100이다**(`domain/share.ts`). 한쪽만 읽힌 구성에서 실제 합으로
  // 정규화하면 그 한쪽이 막대를 다 차지해 「전부 남성」이라고 그리는데, 바로 위
  // 글자는 30%라고 적어 두 줄이 모순되고 막대 쪽이 거짓이다.
  it('합이 100에 못 미치면 빈자리를 남긴다', () => {
    const { container } = render(
      <SplitShareBar
        leftLabel="남성"
        leftValue={30}
        rightLabel="여성"
        rightValue={0}
        title="성별 비율"
      />,
    )

    expect(widths(container)).toEqual(['30%', '0%'])
  })

  // 명세상 합이 100이라는 보장이 없다. 분모를 100으로 고정하면 넘치는 응답에서
  // 폭 합계가 100%를 넘어 막대가 잘린다.
  it('합이 100을 넘으면 실제 합으로 나눈다', () => {
    const { container } = render(
      <SplitShareBar
        leftLabel="남성"
        leftValue={60}
        rightLabel="여성"
        rightValue={60}
        title="성별 비율"
      />,
    )

    expect(widths(container)).toEqual(['50%', '50%'])
  })

  it('소수점은 반올림해서 적는다', () => {
    render(
      <SplitShareBar
        leftLabel="상주"
        leftValue={48.2}
        rightLabel="비상주"
        rightValue={51.8}
        title="거주 비율"
      />,
    )

    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText('52%')).toBeInTheDocument()
  })

  // **두 칸이 같은 색이면 막대가 한 덩어리로 보인다.** 폭은 맞는데 경계가
  // 안 보이니 「48 대 52」가 화면에서 사라진다 — 눈으로만 확인하는 자리라
  // 변이 실험에서 실제로 살아남았다(2026-08-25).
  //
  // 값을 리터럴로 적지 않고 **서로 다른지**만 본다. 색을 바꿀 때 테스트가
  // 옛 값을 지키게 하지 않으려는 것이다.
  it('두 칸을 다른 농도로 칠한다', () => {
    const { container } = render48to52()
    const [left, right] = container.querySelectorAll('[role="img"] > span')

    expect(left.className).not.toBe(right.className)
    // 색상이 아니라 농도로 가른다 — 이 배색의 `tertiary`가 혼잡도
    // 「약간 붐빔」과 같은 값이라, 색상을 쓰면 여성 칸이 등급처럼 읽힌다.
    expect(left.className).toMatch(/^bg-primary/)
    expect(right.className).toMatch(/^bg-primary/)
  })
})
