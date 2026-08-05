import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CongestionMarker } from './CongestionMarker'

describe('CongestionMarker', () => {
  it('혼잡도 4단계가 각기 다른 색 토큰을 쓴다', () => {
    // Tailwind v4는 클래스명을 정적으로 추출한다. 동적 조합으로 만들면 빌드에서
    // 사라져 화면에서 색이 안 나온다 — 그 회귀를 여기서 잡는다.
    const cases = [
      { level: '여유', className: 'bg-calm' },
      { level: '보통', className: 'bg-normal' },
      { level: '약간 붐빔', className: 'bg-busy' },
      { level: '붐빔', className: 'bg-crowded' },
    ] as const

    for (const { level, className } of cases) {
      const { unmount } = render(
        <CongestionMarker
          name="강남역"
          level={level}
          showLabel
          selected={false}
        />,
      )

      expect(screen.getByText(level)).toHaveClass(className)
      unmount()
    }
  })

  it('스냅샷이 없으면 정보 없음으로 표시한다', () => {
    render(
      <CongestionMarker
        name="경복궁"
        level={null}
        showLabel
        selected={false}
      />,
    )

    expect(screen.getByText('정보 없음')).toBeInTheDocument()
    expect(screen.getByText('정보 없음')).toHaveClass(
      'bg-surface-container-high',
    )
  })

  it('줌이 낮으면 라벨을 감추고 핀만 남긴다', () => {
    render(
      <CongestionMarker
        name="강남역"
        level="붐빔"
        showLabel={false}
        selected={false}
      />,
    )

    expect(screen.queryByText('붐빔')).not.toBeInTheDocument()
    // 라벨이 없어도 마커 자체는 남아 있어야 한다.
    expect(screen.getByRole('img', { name: '강남역 붐빔' })).toBeInTheDocument()
  })

  it('접근성 이름에 명소와 혼잡도가 함께 들어간다', () => {
    render(
      <CongestionMarker name="남산공원" level="여유" showLabel selected={false} />,
    )

    expect(
      screen.getByRole('img', { name: '남산공원 여유' }),
    ).toBeInTheDocument()
  })

  it('선택된 마커는 핀이 더 크다', () => {
    const { rerender, container } = render(
      <CongestionMarker name="강남역" level="붐빔" showLabel selected={false} />,
    )
    expect(container.querySelector('svg')).toHaveClass('size-7')

    rerender(<CongestionMarker name="강남역" level="붐빔" showLabel selected />)
    expect(container.querySelector('svg')).toHaveClass('size-9')
  })
})
