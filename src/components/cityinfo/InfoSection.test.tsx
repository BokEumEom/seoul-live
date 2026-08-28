import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InfoSection } from './InfoSection'

describe('InfoSection', () => {
  it('개수를 제목 이름에 섞지 않는다', () => {
    // 「주차장 12」가 heading의 접근성 이름이 되면 목차를 훑는 사용자에게 숫자가
    // 제목의 일부처럼 읽힌다. 눈으로는 같은 줄에 있어도 이름은 「주차장」이어야
    // 한다 — 그래야 절을 이름으로 찾을 수 있다.
    render(
      <InfoSection title="주차장" count={12}>
        <p>내용</p>
      </InfoSection>,
    )

    expect(screen.getByRole('heading', { name: '주차장' })).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('개수가 0이어도 적는다', () => {
    // 「없다」는 것도 정보다. 0을 감추면 「아직 못 받아왔다」와 구별이 안 된다.
    render(
      <InfoSection title="문화행사" count={0}>
        <p>내용</p>
      </InfoSection>,
    )

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('기준 시각을 안 넘기면 아무 말도 만들지 않는다', () => {
    // 없는 note에 기본 문구를 채워 넣으면 방금 받은 값에도 「묵었다」가 붙는다.
    const { container } = render(
      <InfoSection title="도로소통">
        <p>내용</p>
      </InfoSection>,
    )

    expect(container.textContent).toBe('도로소통내용')
  })

  it('기준 시각을 넘기면 값 옆에 적는다', () => {
    // **이 테스트가 정직성을 잠근다.** 도시정보는 1시간 캐시로 받는데 기준을
    // 안 적으면 「4분 후 도착」이 1시간 묵은 값일 때도 지금인 것처럼 읽힌다.
    render(
      <InfoSection title="지하철 도착" note="최대 1시간 전 기준이에요">
        <p>내용</p>
      </InfoSection>,
    )

    expect(screen.getByText('최대 1시간 전 기준이에요')).toBeInTheDocument()
  })
})
