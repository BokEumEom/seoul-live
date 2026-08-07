import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SortSegmented } from './SortSegmented'

describe('SortSegmented', () => {
  it('세 기준을 모두 보여준다', () => {
    render(<SortSegmented value="calm" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '거리순' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '여유한 순' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '붐비는 순' })).toBeInTheDocument()
  })

  it('선택된 기준을 표시한다', () => {
    render(<SortSegmented value="busy" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '붐비는 순' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('선택되지 않은 기준은 표시하지 않는다', () => {
    render(<SortSegmented value="busy" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '여유한 순' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('좌표가 없으면 거리순이 비활성이다', () => {
    render(<SortSegmented value="calm" canSortByDistance={false} onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '거리순' })).toBeDisabled()
  })

  it('좌표가 없어도 나머지 둘은 고를 수 있다', () => {
    render(<SortSegmented value="calm" canSortByDistance={false} onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '여유한 순' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: '붐비는 순' })).toBeEnabled()
  })

  it('누르면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<SortSegmented value="calm" canSortByDistance onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '붐비는 순' }))
    expect(onChange).toHaveBeenCalledWith('busy')
  })

  it('비활성인 거리순을 눌러도 값을 올려보내지 않는다', async () => {
    const onChange = vi.fn()
    render(
      <SortSegmented value="calm" canSortByDistance={false} onChange={onChange} />,
    )
    await userEvent.click(screen.getByRole('tab', { name: '거리순' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
