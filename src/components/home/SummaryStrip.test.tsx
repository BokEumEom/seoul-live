import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CitySummary } from '../../domain/summary'
import { SummaryStrip } from './SummaryStrip'

function summary(overrides: Partial<CitySummary> = {}): CitySummary {
  return {
    total: 30,
    counted: 30,
    byLevel: { 여유: 20, 보통: 3, '약간 붐빔': 0, 붐빔: 7 },
    ...overrides,
  }
}

describe('SummaryStrip', () => {
  it('붐빔 개수를 한 줄로 보여준다', () => {
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /30곳 중 붐빔 7곳/ })).toBeInTheDocument()
  })

  // 픽스처는 total과 counted가 둘 다 30이라 어느 쪽을 읽어도 통과한다.
  // 여기서만 갈라 둔다 — total로 세면 22곳만 응답한 날에도 "30곳 중"이 되어
  // 사용자가 전체를 봤다고 오해한다.
  it('카탈로그 전체가 아니라 정보가 온 개수로 센다', () => {
    render(
      <SummaryStrip
        summary={summary({
          counted: 22,
          byLevel: { 여유: 12, 보통: 3, '약간 붐빔': 0, 붐빔: 7 },
        })}
        alertCount={0}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /22곳 중 붐빔 7곳/ })).toBeInTheDocument()
  })

  // 순서까지 잠근다. `toHaveTextContent(/재난문자 2건/)`만 보면 뒤에 붙이는
  // 구현도 통과하는데, 좁은 시트에서 뒤는 truncate로 잘려 사라지는 자리다.
  // 색도 함께 단언한다 — data-alert만 보면 색 분기를 통째로 지워도 통과한다.
  it('재난문자가 있으면 앞에 세우고 경보로 표시한다', () => {
    render(<SummaryStrip summary={summary()} alertCount={2} onOpen={() => {}} />)
    const strip = screen.getByRole('button')
    expect(screen.getByText('재난문자 2건 · 30곳 중 붐빔 7곳')).toBeInTheDocument()
    expect(strip).toHaveClass('bg-error-container', 'text-on-error-container')
  })

  it('재난문자가 없으면 경보 표시가 아니다', () => {
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={() => {}} />)
    const strip = screen.getByRole('button')
    expect(strip).toHaveClass('bg-secondary-container', 'text-primary')
    expect(strip).not.toHaveClass('bg-error-container')
    expect(screen.queryByText(/재난문자/)).toBeNull()
  })

  it('아직 아무것도 안 왔으면 그렇게 말한다', () => {
    render(
      <SummaryStrip
        summary={summary({ counted: 0, byLevel: { 여유: 0, 보통: 0, '약간 붐빔': 0, 붐빔: 0 } })}
        alertCount={0}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /아직 받지 못했어요/ })).toBeInTheDocument()
  })

  // "센 게 0곳"과 "붐비는 곳이 0곳"은 다르다. 분기 조건을 byLevel.붐빔으로
  // 잘못 잡으면 전부 여유로운 날에 "정보를 받지 못했다"는 거짓말을 한다.
  it('붐빔이 0곳이어도 정보가 왔으면 그대로 센다', () => {
    render(
      <SummaryStrip
        summary={summary({ byLevel: { 여유: 30, 보통: 0, '약간 붐빔': 0, 붐빔: 0 } })}
        alertCount={0}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /30곳 중 붐빔 0곳/ })).toBeInTheDocument()
    expect(screen.queryByText(/받지 못했어요/)).toBeNull()
  })

  // 이름이 상태 읽어주기로 끝나면 눌러서 무엇이 열리는지 알 수 없다. 보이는
  // 문구는 그대로 두고 목적지만 이름에 덧댄다.
  // `›`는 aria-hidden이라 이름에 섞이면 안 된다 — 섞이면 스크린리더가
  // 「홑화살괄호」 같은 글리프 이름을 읽는다.
  it('무엇이 열리는지 이름에 담고 장식 글리프는 뺀다', () => {
    render(<SummaryStrip summary={summary()} alertCount={2} onOpen={() => {}} />)
    const strip = screen.getByRole('button')
    // 하나의 정규식으로 순서까지 잠근다. 둘로 나눠 단언하면 목적지를 문구
    // 앞에 두는 구현도 통과하는데, 음성 제어는 이름 앞쪽으로 매칭하므로
    // 보이는 문구가 앞에 있어야 한다(WCAG 2.5.3).
    expect(strip).toHaveAccessibleName(/재난문자 2건 · 30곳 중 붐빔 7곳.*오늘의 서울 열기/)
    expect(strip).not.toHaveAccessibleName(/›/)
  })

  // 이 컴포넌트의 존재 이유가 "한 줄"이다. truncate가 빠지면 긴 문구가 두 줄로
  // 접히고, half 단계에서 명소가 그만큼 밀려난다. 크기도 시안 토큰으로 잠근다.
  it('한 줄을 넘지 않게 자른다', () => {
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={() => {}} />)
    expect(screen.getByText('30곳 중 붐빔 7곳')).toHaveClass('truncate')
    // py-2도 함께 잠근다. 이 줄이 목록에서 뺏는 높이가 곧 이 컴포넌트의
    // 비용이라(36px = 0.61행) 세로 패딩이 늘면 Task 4가 번 밀도를 도로 먹는다.
    expect(screen.getByRole('button')).toHaveClass('text-label-md', 'py-2')
  })

  it('누르면 콜백이 불린다', async () => {
    const onOpen = vi.fn()
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
