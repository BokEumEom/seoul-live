import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SortSegmented } from './SortSegmented'

describe('SortSegmented', () => {
  // 근거는 `FilterChips.test.tsx`의 같은 이름 테스트에 한 벌 있다 — 요약하면
  // `role="tab"`이 약속하는 tabpanel·aria-controls·화살표 이동이 하나도 없었다.
  // 여기는 이름 없는 `tablist`이기까지 해서 보조기술이 「탭 목록」이라고만
  // 알리고 무엇을 고르는 줄인지 말하지 못했다.
  it('탭이 아니라 이름을 가진 버튼 묶음이다', () => {
    render(<SortSegmented value="calm" canSortByDistance onChange={() => {}} />)

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByRole('group', { name: '정렬' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '여유한 순' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('세 기준을 모두 보여준다', () => {
    render(<SortSegmented value="calm" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '거리순' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '여유한 순' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '붐비는 순' })).toBeInTheDocument()
  })

  it('선택된 기준을 표시한다', () => {
    render(<SortSegmented value="busy" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '붐비는 순' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('선택되지 않은 기준은 표시하지 않는다', () => {
    render(<SortSegmented value="busy" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '여유한 순' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('좌표가 없으면 거리순이 비활성이다', () => {
    render(<SortSegmented value="calm" canSortByDistance={false} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '거리순' })).toBeDisabled()
  })

  it('좌표가 없어도 나머지 둘은 고를 수 있다', () => {
    render(<SortSegmented value="calm" canSortByDistance={false} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '여유한 순' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '붐비는 순' })).toBeEnabled()
  })

  it('누르면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<SortSegmented value="calm" canSortByDistance onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '붐비는 순' }))
    expect(onChange).toHaveBeenCalledWith('busy')
  })

  it('비활성인 거리순을 눌러도 값을 올려보내지 않는다', async () => {
    const onChange = vi.fn()
    render(
      <SortSegmented value="calm" canSortByDistance={false} onChange={onChange} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '거리순' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
