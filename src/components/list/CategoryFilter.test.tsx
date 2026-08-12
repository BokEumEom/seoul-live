import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryFilter } from './CategoryFilter'

describe('CategoryFilter', () => {
  // 근거는 `FilterChips.test.tsx`의 같은 이름 테스트에 한 벌 있다 — 요약하면
  // `role="tab"`이 약속하는 tabpanel·aria-controls·화살표 이동이 하나도 없었다.
  // 정렬 줄과 마찬가지로 이름 없는 `tablist`라 무엇을 고르는 줄인지도 안 나왔다.
  it('탭이 아니라 이름을 가진 버튼 묶음이다', () => {
    render(<CategoryFilter value="전체" onChange={vi.fn()} />)

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByRole('group', { name: '카테고리' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  // 「인구밀집지역」·「발달상권」은 행정 용어라 화면에 그대로 쓰지 않는다.
  // 올려보내는 값은 공식 분류 그대로이고 표시만 바뀐다 — 둘이 갈리는 자리라
  // 이름과 값을 함께 본다.
  it('행정 용어 대신 읽을 수 있는 이름을 쓰되 값은 공식 분류 그대로 올린다', async () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="전체" onChange={onChange} />)

    expect(screen.queryByRole('button', { name: '인구밀집지역' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '역·번화가' }))

    expect(onChange).toHaveBeenCalledWith('인구밀집지역')
  })

  it('고른 것만 눌린 상태다', () => {
    render(<CategoryFilter value="관광특구" onChange={vi.fn()} />)

    const pressed = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')

    expect(pressed).toHaveLength(1)
    // 개수만 세면 한 칸 밀린 칩을 칠해도 통과한다.
    expect(pressed[0]).toHaveAccessibleName('관광특구')
  })
})
