import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('입력하면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    await userEvent.type(screen.getByRole('searchbox'), '성')
    expect(onChange).toHaveBeenCalledWith('성')
  })

  it('값이 있으면 지우기 버튼이 나온다', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="성수" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('값이 없으면 지우기 버튼이 없다', () => {
    render(<SearchBar value="" onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).toBeNull()
  })

  // 「내 주변」은 FAB(RecenterButton)이 흡수했다. 검색 바가 검색만 하는지
  // 여기서 잠근다 — 지도에 대고 하는 동작이 검색 줄에 다시 붙지 않게.
  it('검색 말고 다른 버튼은 두지 않는다', () => {
    render(<SearchBar value="성수" onChange={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '내 주변' })).toBeNull()
  })

  it('입력란이 현재 값을 보여준다', () => {
    render(<SearchBar value="연남동" onChange={() => {}} />)
    expect(screen.getByRole('searchbox')).toHaveValue('연남동')
  })
})
