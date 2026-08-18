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
    ['half', 'bottom-[58%]'],
  ] as ReadonlyArray<readonly [RecenterDetent, string]>)(
    '시트가 %s이면 %s에 선다',
    (detent, bottomClass) => {
      render(<RecenterButton disabled={false} detent={detent} onClick={vi.fn()} />)
      expect(screen.getByRole('button', { name: '내 주변' })).toHaveClass(bottomClass)
    },
  )

  // 넓은 화면에서는 시트가 왼쪽 패널이라 아래가 통째로 비고, 버튼은 화면
  // 아래 끝에서 일정 거리에 선다. **그 거리를 화면 끝에서 재면 안 된다** —
  // 가로로 든 폰(768px을 넘으므로 넓은 화면이다)에서는 그 끝이 홈 인디케이터라
  // 버튼이 그 밑으로 들어간다. 세로 단계의 `bottom-[%]`는 시트를 따라가므로
  // 이 문제가 없고, 여기만 따로 피해야 한다.
  it('시트가 없으면 홈 인디케이터를 피해 선다', () => {
    render(<RecenterButton disabled={false} detent={null} onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: '내 주변' })).toHaveClass('bottom-safe-6')
  })

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

  // 이 버튼이 서는 단계가 시트 단계보다 **정확히 하나 적다**는 것만 본다.
  //
  // `not.toContain('full')`은 여기 두지 않는다. `DETENTS`는 이 파일이 손으로
  // 적은 배열이라 그 단언은 세 줄 위 리터럴에 대한 동어반복이고, full을
  // 프로덕션에 되살려도 안 깨진다. **진짜 잠금은 이 테스트가 아니다** —
  // `Record<RecenterDetent, string>`이 컴파일에서 막고(`TS2353`),
  // 화면 쪽은 `HomeScreen.test.tsx`의 「시트가 전체로 펼쳐지면 내 주변 버튼도
  // 함께 물러난다」가 막는다. 여기서 지키는 것은 시트 단계가 넷으로 늘 때
  // 이 표를 같이 손보게 만드는 것뿐이다.
  it('버튼이 서는 단계가 시트 단계보다 하나 적다', () => {
    expect(DETENTS).toHaveLength(Object.keys(SHEET_RATIO).length - 1)
  })
})
