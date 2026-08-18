import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reset, setTheme } from '../../hooks/themeStore'
import { ThemeToggle } from './ThemeToggle'

vi.mock('../../platform/theme', () => ({
  loadTheme: vi.fn().mockResolvedValue('light'),
  saveTheme: vi.fn().mockResolvedValue(undefined),
}))

/** 기기가 어둡다고 답할지 정한다. 「기기 설정」일 때만 결과가 갈린다. */
function stubMatchMedia(prefersDark: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: prefersDark,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

beforeEach(() => {
  reset()
  stubMatchMedia(false)
})

afterEach(() => {
  reset()
})

describe('ThemeToggle', () => {
  it('밝을 때는 어둡게 바꾸겠다고 말한다', () => {
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: '어두운 화면으로 바꾸기' }),
    ).toBeInTheDocument()
  })

  it('누르면 어두워지고 이름이 반대로 바뀐다', async () => {
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button', { name: '어두운 화면으로 바꾸기' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    // 이름이 안 따라오면 두 번째 누름이 무엇을 할지 알 수 없다.
    expect(
      screen.getByRole('button', { name: '밝은 화면으로 바꾸기' }),
    ).toBeInTheDocument()
  })

  it('다시 누르면 밝아진다', async () => {
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button', { name: '어두운 화면으로 바꾸기' }))
    await userEvent.click(screen.getByRole('button', { name: '밝은 화면으로 바꾸기' }))

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('「기기 설정」이고 기기가 어두우면 밝게 바꾸겠다고 말한다', () => {
    // **고른 값이 아니라 지금 칠해진 색을 봐야 한다.** 설정만 보면 `'system'`은
    // 밝은지 어두운지 알 수 없어, 어두운 화면에서 「어둡게 바꾸기」라고
    // 말하게 된다 — 눌러도 아무것도 안 바뀐 것처럼 보인다.
    stubMatchMedia(true)
    setTheme('system')
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: '밝은 화면으로 바꾸기' }),
    ).toBeInTheDocument()
  })

  it('「기기 설정」에서 누르면 명시적인 값으로 굳는다', async () => {
    // 기기를 따르던 상태에서 뒤집었으면 그 뜻은 「이제 내가 정한다」이다.
    // `'system'`으로 남겨 두면 기기가 바뀌는 순간 되돌아가 버린다.
    stubMatchMedia(true)
    setTheme('system')
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button', { name: '밝은 화면으로 바꾸기' }))

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
