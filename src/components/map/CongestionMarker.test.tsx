import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CongestionMarker } from './CongestionMarker'

describe('CongestionMarker', () => {
  // **예전 이 테스트는 「Tailwind의 정적 추출 때문에 동적 조합이 빌드에서
  // 사라지는 회귀를 잡는다」고 적혀 있었는데 그건 거짓이었다.** 누가
  // `` `bg-${tone}` ``으로 바꿔도 React는 그 문자열을 그대로 렌더하므로 DOM에는
  // `bg-calm`이 찍히고, jsdom에는 CSS가 없어 그것이 실제로 색을 내는지 알 수
  // 없다. 즉 이 자리에서 그 회귀는 **관찰 불가능**하다(그 규칙은
  // `toneClass.ts`·`CongestionMarker`의 주석과 리뷰가 지킨다).
  //
  // 잡을 수 있는 것은 **네 단계가 서로 다른 채움을 받는가**다. 표를 한 칸
  // 밀어 쓰거나 두 단계에 같은 값을 주면 여기서 죽는다. 클래스 이름을 박아
  // 두지 않으므로 토큰 이름을 바꿔도 이 테스트는 살아 있다 — 예전 형태는
  // 이름이 바뀔 때마다 함께 고쳐야 했고, 그때 「무엇을 지키는 테스트인가」가
  // 흐려진다.
  it('혼잡도 4단계가 서로 다른 채움을 받는다', () => {
    const levels = ['여유', '보통', '약간 붐빔', '붐빔'] as const

    const fills = levels.map((level) => {
      const { unmount } = render(
        <CongestionMarker
          name="강남역"
          level={level}
          showLabel
          selected={false}
        />,
      )
      const found = screen.getByText(level).className.match(/\bbg-[a-z0-9-]+/)
      unmount()
      return found?.[0]
    })

    expect(fills.every((fill) => fill !== undefined)).toBe(true)
    expect(new Set(fills).size).toBe(levels.length)
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
    // 알약이 어두워야 밝은 지도 타일 위에서 보인다. 예전 값
    // `bg-surface-container-high`(#e1e2ed)는 밝은 타일과 1.1이라 알약 자체가
    // 사라졌고, 그러면 그 명소가 없는 것처럼 읽힌다.
    expect(screen.getByText('정보 없음')).toHaveClass('bg-on-surface-variant')
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
