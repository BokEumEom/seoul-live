import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Detent } from '../../domain/sheet'
import { RecenterButton } from './RecenterButton'

describe('RecenterButton', () => {
  it('누르면 콜백을 부른다', async () => {
    const onClick = vi.fn()
    render(<RecenterButton disabled={false} detent="half" onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('좌표가 없으면 비활성이고 눌러도 반응하지 않는다', async () => {
    // 위치 권한을 거부한 사용자가 눌렀을 때 아무 일도 안 일어나면 버튼이
    // 고장 난 것처럼 보인다. 비활성으로 만들어 누를 수 없음을 먼저 알린다.
    const onClick = vi.fn()
    render(<RecenterButton disabled detent="half" onClick={onClick} />)

    const button = screen.getByRole('button', { name: '내 주변' })
    expect(button).toBeDisabled()

    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  // 세 단계를 모두 확인한다. 한 단계만 보면 위치를 상수로 박아 둔 구현도
  // 통과한다. 같은 z-20이고 시트가 DOM에서 뒤라, 올리지 않으면 시트가 이
  // 버튼을 덮는다.
  it.each([
    ['peek', 'bottom-[18%]'],
    ['half', 'bottom-[48%]'],
    ['full', 'bottom-[94%]'],
  ] as ReadonlyArray<readonly [Detent, string]>)(
    '시트가 %s이면 %s에 선다',
    (detent, bottomClass) => {
      render(<RecenterButton disabled={false} detent={detent} onClick={vi.fn()} />)
      expect(screen.getByRole('button', { name: '내 주변' })).toHaveClass(bottomClass)
    },
  )
})
