import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reset } from '../../hooks/themeStore'
import { ThemeSetting } from './ThemeSetting'

vi.mock('../../platform/theme', () => ({
  loadTheme: vi.fn().mockResolvedValue('light'),
  saveTheme: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  reset()
  // 기기는 어둡다고 답한다. 그런데도 기본은 밝게여야 한다 — 그게 이 변경의 핵심이다.
  window.matchMedia = ((query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
})

afterEach(() => {
  reset()
})

describe('ThemeSetting', () => {
  it('세 가지를 고를 수 있고 밝게가 눌려 있다', () => {
    // 기기가 어둡다고 답하는 중이다(위 beforeEach). 그래도 눌린 것은 밝게다.
    render(<ThemeSetting />)

    expect(screen.getByRole('button', { name: '밝게' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '어둡게' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: '기기 설정' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('어둡게를 고르면 화면이 어두워진다', async () => {
    render(<ThemeSetting />)

    await userEvent.click(screen.getByRole('button', { name: '어둡게' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: '어둡게' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('무엇을 고르는 줄인지 이름을 붙인다', () => {
    // 이름 없는 `group`은 보조기술이 「그룹」이라고만 알리고 무엇을 고르는
    // 줄인지 말하지 못한다 — `SortSegmented`와 같은 이유다.
    render(<ThemeSetting />)

    expect(screen.getByRole('group', { name: '화면 테마' })).toBeInTheDocument()
  })
})
