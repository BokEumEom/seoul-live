import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CityAlert } from '../../domain/cityInfo'
import { AlertDigest } from './AlertDigest'

function alert(message: string): CityAlert {
  return { category: '기상', step: '주의보', message, createdAt: '2026-08-07 11:00' }
}

describe('AlertDigest', () => {
  it('재난문자가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<AlertDigest alerts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('같은 문구가 여러 번 실려도 한 번만 그린다', () => {
    // 폭염 경보 하나가 30곳에 실려 오면 화면이 같은 문장으로 도배된다.
    const same = alert('호우 주의보')
    render(<AlertDigest alerts={[same, same, same]} />)
    expect(screen.getAllByText('호우 주의보')).toHaveLength(1)
    expect(screen.getByText(/재난문자 1건/)).toBeInTheDocument()
  })

  it('서로 다른 문구는 모두 그린다', () => {
    render(<AlertDigest alerts={[alert('호우 주의보'), alert('폭염 경보')]} />)
    expect(screen.getByText(/재난문자 2건/)).toBeInTheDocument()
  })

  // **낭독을 가로채지 않는다.** `role="alert"`은 assertive 라이브 리전이라
  // 보조기술이 읽던 것을 끊는다. 그 값을 하는 것은 「방금 일어난 일」인데
  // 이 절은 상세에서 **이미 받아둔 캐시**를 모아 보여주는 목록이고,
  // 「오늘의 서울」을 열 때 내용을 가진 채로 삽입된다 — 사용자가 스스로 연
  // 화면의 한 절을 읽다 말고 끊길 이유가 없다.
  //
  // 대신 제목(h3)이 구조를 준다. 형제 절들(`RankList`·`CategoryAverages`)도
  // 같은 모양이라 이 절만 landmark로 올리지 않는다.
  //
  // 두 가지를 함께 본다. `role`만 지우고 `aria-live="assertive"`를 얹으면
  // 같은 일이 되므로 한쪽만 막으면 우회가 남는다.
  it('낭독을 가로채는 리전이 아니다', () => {
    render(<AlertDigest alerts={[alert('호우 주의보')]} />)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/재난문자 1건/).closest('[aria-live]')).toBeNull()
  })

  it('제목으로 훑을 수 있다', () => {
    // role을 걷어낸 뒤에도 이 절에 닿는 길이 남아야 한다.
    render(<AlertDigest alerts={[alert('호우 주의보')]} />)

    expect(
      screen.getByRole('heading', { name: /재난문자 1건/ }),
    ).toBeInTheDocument()
  })
})
