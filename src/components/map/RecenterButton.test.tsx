import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecenterButton } from './RecenterButton'

describe('RecenterButton', () => {
  it('누르면 콜백을 부른다', async () => {
    const onClick = vi.fn()
    render(<RecenterButton disabled={false} onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: '내 위치로 이동' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('좌표가 없으면 비활성이고 눌러도 반응하지 않는다', async () => {
    // 위치 권한을 거부한 사용자가 눌렀을 때 아무 일도 안 일어나면 버튼이
    // 고장 난 것처럼 보인다. 비활성으로 만들어 누를 수 없음을 먼저 알린다.
    const onClick = vi.fn()
    render(<RecenterButton disabled onClick={onClick} />)

    const button = screen.getByRole('button', { name: '내 위치로 이동' })
    expect(button).toBeDisabled()

    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
