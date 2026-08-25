import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { reset, setLanguage } from '../../hooks/languageStore'
import { SubwayLineBadge } from './SubwayLineBadge'

describe('SubwayLineBadge', () => {
  afterEach(() => {
    reset()
  })

  it('숫자 호선은 숫자만 보여준다', () => {
    render(<SubwayLineBadge line="3호선" />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // **색만으로 노선을 말하지 않는다.** 색각 이상이면 3호선 주황과 6호선 갈색이
  // 같아 보이고, 스크린리더에는 색이 아예 안 간다.
  it('배지가 제 이름을 갖는다', () => {
    render(<SubwayLineBadge line="3호선" />)

    expect(screen.getByRole('img')).toHaveAccessibleName('3호선')
  })

  // 눈에 보이는 글자는 숫자뿐이라, 영어 화면에서 옮겨야 할 것은 소리 쪽이다.
  it('영어에서는 접근성 이름이 영어다', () => {
    setLanguage('en')
    render(<SubwayLineBadge line="3호선" />)

    expect(screen.getByRole('img')).toHaveAccessibleName('Line 3')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('노선 색으로 칠한다', () => {
    render(<SubwayLineBadge line="1호선" />)

    // jsdom이 색을 `rgb()`로 정규화한다. #0052a4.
    expect(screen.getByRole('img')).toHaveStyle({ backgroundColor: 'rgb(0, 82, 164)' })
  })

  // **모르는 노선은 배지가 없다.** 회색 동그라미를 그리면 「색이 없는 노선」이라는
  // 없는 분류를 만든다 — 부르는 쪽이 옛 글자 표기로 돌아가게 `null`을 준다.
  it('모르는 노선은 아무것도 그리지 않는다', () => {
    const { container } = render(<SubwayLineBadge line="위례선" />)

    expect(container).toBeEmptyDOMElement()
  })
})
