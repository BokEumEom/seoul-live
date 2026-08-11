import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SHEET_RATIO } from '../../domain/sheet'
import { RecenterButton, type RecenterDetent } from './RecenterButton'

/** 이 버튼이 설 수 있는 단계 전부. `full`은 자리가 없어 타입에서 빠져 있다. */
const DETENTS: readonly RecenterDetent[] = ['peek', 'half']

/** 버튼 아래를 시트 상단보다 이만큼 위에 둔다(부모 높이 대비 비율). */
const GAP_RATIO = 0.02

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

  // 두 단계 모두 확인한다. 한 단계만 보면 위치를 상수로 박아 둔 구현도
  // 통과한다. 같은 z-20이고 시트가 DOM에서 뒤라, 올리지 않으면 시트가 이
  // 버튼을 덮는다.
  it.each([
    ['peek', 'bottom-[18%]'],
    ['half', 'bottom-[48%]'],
  ] as ReadonlyArray<readonly [RecenterDetent, string]>)(
    '시트가 %s이면 %s에 선다',
    (detent, bottomClass) => {
      render(<RecenterButton disabled={false} detent={detent} onClick={vi.fn()} />)
      expect(screen.getByRole('button', { name: '내 주변' })).toHaveClass(bottomClass)
    },
  )

  // 위 표는 「값」을 보고 이 테스트는 「관계」를 본다. 표만 있으면 시트 비율을
  // 고칠 때 버튼이 따라가지 않는 것을 아무도 못 막는다 — 표는 새 값에 맞춰
  // 함께 고쳐지면 그만이기 때문이다.
  //
  // 런타임에 `bottom-[${ratio}%]`로 조합하지는 못한다. Tailwind v4는 정적
  // 추출이라 그런 클래스는 빌드에서 사라진다. 하지만 **테스트 쪽 계산은 막을
  // 것이 없다** — 클래스에 적힌 수를 도로 꺼내 시트 비율에서 파생되는지 본다.
  //
  // 제목에 `%`를 쓰지 않는다. vitest의 it.each 포맷터가 그것을 자리표시자로
  // 읽어 제목이 깨진다.
  it.each(DETENTS)('%s 단계의 버튼 위치가 시트 높이에서 파생된다', (detent) => {
    render(<RecenterButton disabled={false} detent={detent} onClick={vi.fn()} />)
    const className = screen.getByRole('button', { name: '내 주변' }).className
    const found = className.match(/bottom-\[(\d+(?:\.\d+)?)%\]/)

    expect(found).not.toBeNull()
    expect(Number(found![1]) / 100).toBeCloseTo(SHEET_RATIO[detent] + GAP_RATIO, 10)
  })

  // full은 렌더할 수 없다 — 타입에서 빠져 있고, 그 이유는 48px 버튼이 들어갈
  // 자리(`0.06H`)가 실기기 높이에서 언제나 48px보다 작기 때문이다. 자리가
  // 없다는 사실 자체는 기하라서 jsdom으로 못 잡지만, **full이 이 표에 없다**는
  // 것은 잡을 수 있다. 되살리면 이 테스트가 먼저 막는다.
  it('full 단계의 자리는 아예 두지 않는다', () => {
    const detents: readonly string[] = DETENTS
    expect(detents).not.toContain('full')
    expect(detents).toHaveLength(Object.keys(SHEET_RATIO).length - 1)
  })
})
