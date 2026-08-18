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
          showName={false}
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
        showName={false}
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
        showName={false}
      />,
    )

    expect(screen.queryByText('붐빔')).not.toBeInTheDocument()
    // 라벨이 없어도 마커 자체는 남아 있어야 한다.
    expect(screen.getByRole('img', { name: '강남역 붐빔' })).toBeInTheDocument()
  })

  it('접근성 이름에 명소와 혼잡도가 함께 들어간다', () => {
    render(
      <CongestionMarker
        name="남산공원"
        level="여유"
        showLabel
        showName={false}
        selected={false}
      />,
    )

    expect(
      screen.getByRole('img', { name: '남산공원 여유' }),
    ).toBeInTheDocument()
  })

  // ── 이름표 ──────────────────────────────────────────────────────────────
  //
  // 서울 인파레이더는 지도에서 곧바로 「거기가 어디인지」를 읽게 한다. 우리는
  // 핀 색으로 혼잡도만 말하고 이름은 목록에만 있어서, 지도를 보는 동안에는
  // 어느 점이 어디인지 알 수 없었다.
  it('이름표를 켜면 명소 이름이 핀 아래에 뜬다', () => {
    render(
      <CongestionMarker
        name="인사동"
        level="여유"
        showLabel
        showName
        selected={false}
      />,
    )

    expect(screen.getByText('인사동')).toBeInTheDocument()
  })

  it('줌이 얕으면 이름표를 감춘다', () => {
    render(
      <CongestionMarker
        name="인사동"
        level="여유"
        showLabel
        showName={false}
        selected={false}
      />,
    )

    expect(screen.queryByText('인사동')).not.toBeInTheDocument()
  })

  // **선택된 곳은 줌과 무관하게 이름을 단다.** 목록에서 골라 지도가 그리로
  // 움직였을 때, 여러 핀 중 어느 것이 방금 고른 것인지 말해 주는 유일한 표시다.
  it('선택된 마커는 줌이 얕아도 이름을 단다', () => {
    render(
      <CongestionMarker
        name="인사동"
        level="여유"
        showLabel
        showName={false}
        selected
      />,
    )

    expect(screen.getByText('인사동')).toBeInTheDocument()
  })

  // **이름표는 흐름에서 빠져 있어야 한다.** `AdvancedMarker`는 내용물의 아래
  // 끝을 좌표에 맞추므로, 핀 아래에 흐름으로 놓으면 핀이 그만큼 위로 밀려
  // 실제 위치를 안 가리킨다 — 390×844 실측에서 핀 하단이 186px에서 168px로
  // **18px 올라갔다.** jsdom에는 레이아웃이 없어 그 18px 자체는 여기서 못
  // 재고(`BottomSheet`의 히트 영역과 같은 처지다), 그것을 만드는 클래스는 잠근다.
  it('이름표가 핀의 자리를 밀지 않는다', () => {
    render(
      <CongestionMarker name="인사동" level="여유" showLabel showName selected={false} />,
    )

    expect(screen.getByText('인사동')).toHaveClass('absolute')
  })

  // 이름표가 생겨도 접근성 이름은 한 번만 읽혀야 한다. 알약·이름표·컨테이너가
  // 각자 이름을 가지면 보조기술이 「인사동 여유 인사동」이라고 읽는다.
  it('이름표를 켜도 접근성 이름이 겹치지 않는다', () => {
    render(
      <CongestionMarker name="인사동" level="여유" showLabel showName selected />,
    )

    expect(screen.getByRole('img', { name: '인사동 여유' })).toBeInTheDocument()
  })

  it('선택된 마커는 핀이 더 크다', () => {
    const { rerender, container } = render(
      <CongestionMarker
        name="강남역"
        level="붐빔"
        showLabel
        showName={false}
        selected={false}
      />,
    )
    expect(container.querySelector('svg')).toHaveClass('size-7')

    rerender(
      <CongestionMarker
        name="강남역"
        level="붐빔"
        showLabel
        showName={false}
        selected
      />,
    )
    expect(container.querySelector('svg')).toHaveClass('size-9')
  })
})
