import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterChips } from './FilterChips'

const COUNTS = { fav: 3, kids: 10, date: 19, hot: 7 } as const

describe('FilterChips', () => {
  it('내 장소가 맨 앞이고 프리셋 셋이 순서대로 뒤따른다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)

    // 줄 전체를 고정한다. 첫 칸만 보면 뒤의 셋을 아무렇게나 섞어도 통과한다.
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '')
    expect(names).toEqual([
      expect.stringContaining('내 장소'),
      expect.stringContaining('아이와 나들이'),
      expect.stringContaining('데이트'),
      expect.stringContaining('지금 핫플'),
    ])
  })

  it('개수를 함께 보여준다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '내 장소 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '아이와 나들이 10' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '데이트 19' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '지금 핫플 7' })).toBeInTheDocument()
  })

  it('★는 눈에만 보이고 접근성 이름에는 들어가지 않는다', () => {
    // 「내 장소」가 이미 같은 말을 한다. ★를 이름에 넣으면 스크린리더가
    // "블랙 스타 내 장소 3"으로 읽는다.
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)

    const chip = screen.getByRole('tab', { name: '내 장소 3' })
    expect(chip).toHaveTextContent('★')
    expect(chip).toHaveAccessibleName('내 장소 3')
  })

  it('0이면 비활성이다', () => {
    render(
      <FilterChips counts={{ ...COUNTS, fav: 0 }} value={null} onChange={vi.fn()} />,
    )

    expect(screen.getByRole('tab', { name: '내 장소 0' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: '지금 핫플 7' })).toBeEnabled()
  })

  it('고르면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<FilterChips counts={COUNTS} value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: '내 장소 3' }))

    expect(onChange).toHaveBeenCalledWith('fav')
  })

  it('선택된 칩을 다시 누르면 해제된다', async () => {
    const onChange = vi.fn()
    render(<FilterChips counts={COUNTS} value="fav" onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: '내 장소 3' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('한 번에 하나만, 그것도 고른 그 칩만 선택된다', () => {
    render(<FilterChips counts={COUNTS} value="kids" onChange={vi.fn()} />)

    const tabs = screen.getAllByRole('tab')
    const selected = tabs.filter(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    )
    expect(selected).toHaveLength(1)
    // 개수만 세면 한 칸 밀린 칩을 칠해도 통과한다.
    expect(selected[0]).toHaveAccessibleName('아이와 나들이 10')
    // 나머지는 aria-selected가 빠진 게 아니라 false여야 한다.
    expect(
      tabs.filter((tab) => tab.getAttribute('aria-selected') === 'false'),
    ).toHaveLength(3)
  })

  it('비활성인 칩을 눌러도 값이 안 올라간다', async () => {
    const onChange = vi.fn()
    render(
      <FilterChips counts={{ ...COUNTS, hot: 0 }} value={null} onChange={onChange} />,
    )

    await userEvent.click(screen.getByRole('tab', { name: '지금 핫플 0' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('선택된 칩은 0이 돼도 해제할 수 있다', async () => {
    // 즐겨찾기를 다 지우거나 카테고리를 좁히면 고른 칩이 0이 된다. 그때도
    // 비활성으로 굳으면 필터를 풀 방법이 사라져 빈 목록에 갇힌다.
    const onChange = vi.fn()
    render(<FilterChips counts={{ ...COUNTS, fav: 0 }} value="fav" onChange={onChange} />)

    const chip = screen.getByRole('tab', { name: '내 장소 0' })
    expect(chip).toBeEnabled()

    await userEvent.click(chip)

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
