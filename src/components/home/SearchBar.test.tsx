import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('입력하면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} onRecenter={() => {}} canRecenter />)
    await userEvent.type(screen.getByRole('searchbox'), '성')
    expect(onChange).toHaveBeenCalledWith('성')
  })

  it('값이 있으면 지우기 버튼이 나온다', async () => {
    const onChange = vi.fn()
    render(
      <SearchBar value="성수" onChange={onChange} onRecenter={() => {}} canRecenter />,
    )
    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('값이 없으면 지우기 버튼이 없다', () => {
    render(<SearchBar value="" onChange={() => {}} onRecenter={() => {}} canRecenter />)
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).toBeNull()
  })

  it('좌표가 없으면 내 주변이 비활성이다', () => {
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        onRecenter={() => {}}
        canRecenter={false}
      />,
    )
    expect(screen.getByRole('button', { name: '내 주변' })).toBeDisabled()
  })

  it('내 주변을 누르면 콜백이 불린다', async () => {
    const onRecenter = vi.fn()
    render(<SearchBar value="" onChange={() => {}} onRecenter={onRecenter} canRecenter />)
    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))
    expect(onRecenter).toHaveBeenCalledTimes(1)
  })

  it('비활성인 내 주변을 눌러도 콜백이 불리지 않는다', async () => {
    const onRecenter = vi.fn()
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        onRecenter={onRecenter}
        canRecenter={false}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))
    expect(onRecenter).not.toHaveBeenCalled()
  })

  it('입력란이 현재 값을 보여준다', () => {
    render(
      <SearchBar value="연남동" onChange={() => {}} onRecenter={() => {}} canRecenter />,
    )
    expect(screen.getByRole('searchbox')).toHaveValue('연남동')
  })
})
