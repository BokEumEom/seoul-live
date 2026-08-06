import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PresetFilter } from './PresetFilter'

const COUNTS = { kids: 3, date: 12, hot: 5 } as const

describe('PresetFilter', () => {
  it('세 프리셋을 개수와 함께 보여준다', () => {
    render(<PresetFilter counts={COUNTS} value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '아이와 나들이 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '데이트 12' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '지금 핫플 5' })).toBeInTheDocument()
  })

  it('개수가 0이면 비활성이다', () => {
    // 눌렀는데 아무 일도 안 일어나는 순간을 만들지 않는다. 새벽에는
    // 붐비는 곳이 없어 「지금 핫플」이 실제로 0이 된다.
    render(
      <PresetFilter
        counts={{ kids: 10, date: 19, hot: 0 }}
        value={null}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('tab', { name: '지금 핫플 0' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: '아이와 나들이 10' })).not.toBeDisabled()
  })

  it('누르면 그 키를 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<PresetFilter counts={COUNTS} value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: '데이트 12' }))

    expect(onChange).toHaveBeenCalledWith('date')
  })

  it('선택된 칩을 다시 누르면 해제한다', async () => {
    // 「전체」 칩을 따로 두면 지도 상단을 한 칸 더 먹는다. 재클릭이 해제다.
    const onChange = vi.fn()
    render(<PresetFilter counts={COUNTS} value="date" onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: '데이트 12' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('선택된 칩만 강조한다', () => {
    render(<PresetFilter counts={COUNTS} value="hot" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '지금 핫플 5' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: '데이트 12' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('비활성 칩은 눌러도 반응하지 않는다', async () => {
    const onChange = vi.fn()
    render(
      <PresetFilter
        counts={{ kids: 0, date: 0, hot: 0 }}
        value={null}
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: '아이와 나들이 0' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
