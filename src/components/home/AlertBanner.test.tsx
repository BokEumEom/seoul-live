import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CityAlert } from '../../domain/cityInfo'
import { AlertBanner } from './AlertBanner'

function alert(message: string): CityAlert {
  return { category: '호우', step: '경보', message, createdAt: '' }
}

describe('AlertBanner', () => {
  // 경보가 없는 날이 대부분이다. 빈 배너를 세우면 세로 공간을 상시로 먹는다.
  it('경보가 없으면 그리지 않는다', () => {
    const { container } = render(
      <AlertBanner alerts={[]} onOpen={() => undefined} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // **본문을 보여주는 것이 이 배너의 전부다.** 예전에는 요약 줄이 「재난문자
  // 1건」이라는 건수만 말했는데, 건수로는 대피해야 할 일인지 알 수 없다.
  it('경보 본문을 그대로 보여준다', () => {
    render(
      <AlertBanner
        alerts={[alert('[서울특별시] 오늘 15시 폭염경보. 야외활동을 자제하세요.')]}
        onOpen={() => undefined}
      />,
    )

    expect(
      screen.getByText(/오늘 15시 폭염경보/),
    ).toBeInTheDocument()
  })

  // 여러 건이면 첫 줄만 세우고 나머지는 수로 말한다. 다 펼치면 배너가 화면을
  // 덮어 정작 지도와 목록을 못 본다.
  it('여러 건이면 첫 건과 나머지 수를 말한다', () => {
    render(
      <AlertBanner
        alerts={[alert('폭염경보'), alert('호우주의보'), alert('강풍주의보')]}
        onOpen={() => undefined}
      />,
    )

    expect(screen.getByText('폭염경보')).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
    expect(screen.queryByText('호우주의보')).not.toBeInTheDocument()
  })

  it('한 건이면 나머지 수를 말하지 않는다', () => {
    render(<AlertBanner alerts={[alert('폭염경보')]} onOpen={() => undefined} />)

    expect(screen.queryByText(/외 /)).not.toBeInTheDocument()
  })

  it('누르면 전체 목록을 여는 손잡이가 된다', async () => {
    const onOpen = vi.fn()
    render(<AlertBanner alerts={[alert('폭염경보')]} onOpen={onOpen} />)

    await userEvent.click(screen.getByRole('button'))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  // **`role="alert"`을 쓰지 않는다.** assertive 리전이라 보조기술이 읽던 것을
  // 끊는데, 이 배너는 앱을 열면 이미 자리에 있는 것이라 「방금 일어난 일」이
  // 아니다. `AlertDigest`가 같은 판단을 한 근거를 여기서도 지킨다.
  it('보조기술이 읽던 것을 끊지 않는다', () => {
    render(<AlertBanner alerts={[alert('폭염경보')]} onOpen={() => undefined} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
