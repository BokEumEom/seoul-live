import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Detent } from '../../domain/sheet'
import { BottomSheet } from './BottomSheet'

function viewportRect(height: number): DOMRect {
  return {
    top: 0,
    height,
    bottom: height,
    left: 0,
    right: 400,
    width: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}

function setup(onDetentChange = vi.fn(), detent: Detent = 'half') {
  const { container } = render(
    <BottomSheet detent={detent} onDetentChange={onDetentChange}>
      <div>시트내용</div>
    </BottomSheet>,
  )
  const sheet = container.firstElementChild as HTMLElement
  // jsdom은 레이아웃을 계산하지 않는다. 비율 계산이 0으로 나누지 않도록 심는다.
  const rect = vi
    .spyOn(sheet.parentElement as HTMLElement, 'getBoundingClientRect')
    .mockReturnValue(viewportRect(800))
  // 드래그 도중에 부모가 접히는 상황을 만들기 위한 손잡이. 값을 고쳐 쓰지 않고
  // 목이 돌려줄 rect를 새로 갈아 끼운다.
  const setViewportHeight = (height: number): void => {
    rect.mockReturnValue(viewportRect(height))
  }
  return { handle: screen.getByRole('separator'), onDetentChange, sheet, setViewportHeight }
}

// 한 손가락으로 끌었다 놓는 표준 시퀀스. 포인터 id가 섞이거나 취소가 끼는
// 테스트는 이걸 쓰지 않는다 — 거기서는 어떤 이벤트가 어떤 id로 오는지가 곧
// 검증 대상이다.
function drag(handle: HTMLElement, from: number, to: number, release = to): void {
  fireEvent.pointerDown(handle, { clientY: from, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientY: to, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientY: release, pointerId: 1 })
}

// 세 단계 모두를 확인한다. 한 단계만 보면 높이를 상수로 박아 둔 구현도 통과한다.
const HEIGHT: ReadonlyArray<readonly [Detent, string]> = [
  ['peek', '16%'],
  ['half', '46%'],
  ['full', '92%'],
]

describe('BottomSheet', () => {
  it('내용을 그린다', () => {
    setup()
    expect(screen.getByText('시트내용')).toBeInTheDocument()
  })

  it.each(HEIGHT)('%s 단계에 맞는 높이를 준다', (detent, height) => {
    const { sheet } = setup(vi.fn(), detent)
    expect(sheet.style.height).toBe(height)
  })

  it('위로 끌어 놓으면 full이 된다', () => {
    const { handle, onDetentChange } = setup()
    drag(handle, 430, 100)
    // 아래에서 100px 남은 지점 = 시트 높이 700/800 = 0.875 → full(0.92)에 가장 가깝다
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('아래로 끌어 놓으면 peek이 된다', () => {
    const { handle, onDetentChange } = setup()
    drag(handle, 430, 700)
    expect(onDetentChange).toHaveBeenLastCalledWith('peek')
  })

  it('끌던 도중이 아니라 놓은 자리가 단계를 정한다', () => {
    // 위로 끌었다가 마음을 바꿔 도로 내리고 놓은 경우. 지나간 자리가 아니라
    // 손을 뗀 자리가 답이어야 한다.
    const { handle, onDetentChange } = setup()
    drag(handle, 430, 100, 700)
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('peek')
  })

  it('놓은 자리를 계산할 수 없으면 단계를 바꾸지 않는다', () => {
    // 손을 떼는 순간 부모가 접혀 있으면(높이 0) 비율을 낼 근거가 없다.
    // 낡은 값으로 찍지 않고 단계를 그대로 두는 쪽이 정의된 상태다.
    const { handle, onDetentChange, setViewportHeight } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    setViewportHeight(0)
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
    // 여기를 `expect(() => fireEvent...).not.toThrow()`로 감싸도 소용없다. jsdom은
    // 리스너 안에서 난 예외를 dispatchEvent 밖으로 내보내지 않아 그 단언은 언제나
    // 통과한다(실제로 확인했다). 핸들러가 터지면 vitest의 unhandled error로 잡혀
    // 실행 자체가 실패하므로, 예외 없음은 그쪽이 지킨다.
  })

  it('취소되면 단계를 바꾸지 않는다', () => {
    // pointercancel은 "여기서 놓았다"가 아니라 "이 제스처는 없던 일"이다.
    // 웹뷰가 제스처를 가져갈 때마다 시트가 확정되면 안 된다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerCancel(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('취소된 뒤에도 다시 끌 수 있다', () => {
    // 취소가 추적 상태를 놓지 않으면 이후 모든 pointerdown이 조용히 삼켜져
    // 손잡이가 죽는다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerCancel(handle, { clientY: 430, pointerId: 1 })
    drag(handle, 430, 100)
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('끌지 않고 누르기만 하면 단계가 안 바뀐다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 430, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('누르지 않고 지나가는 포인터는 무시한다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('다른 포인터의 움직임은 무시한다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 2 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 2 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('다른 포인터가 움직여도 잡은 손가락은 끈 것이 아니다', () => {
    // 잡은 손가락(1)은 가만있고 다른 손가락(2)만 움직였다. 그러고서 1을 뗀다 —
    // 2의 움직임이 1의 드래그로 둔갑하면 안 된다. 손을 뗀 것도 1이라 up 쪽
    // 가드는 여기서 아무것도 걸러 주지 않는다. move 쪽 가드만이 이걸 막는다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 2 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('다른 포인터가 떨어져도 잡고 있던 손가락은 계속 끈다', () => {
    // 두 번째 손가락이 먼저 떨어졌다고 첫 손가락의 드래그를 놓아버리면
    // 손잡이가 손끝 아래에서 죽는다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 700, pointerId: 2 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('더블클릭하면 half로 돌아간다', () => {
    const { handle, onDetentChange } = setup(vi.fn(), 'full')
    fireEvent.doubleClick(handle)
    expect(onDetentChange).toHaveBeenCalledWith('half')
  })

  it('손잡이에 접근 가능한 이름이 있다', () => {
    const { handle } = setup()
    expect(handle).toHaveAccessibleName('시트 높이 조절')
  })

  it('내용 영역이 스크롤된다', () => {
    setup()
    // 손잡이는 고정이고 내용만 흐른다 — full에서 상세를 스크롤할 때
    // 시트가 따라 내려가면 안 된다.
    //
    // `min-h-0`·`flex-1`까지 함께 건다. 실제로 넘치는 내용을 줄여 주는 건
    // 이 둘이고, `overflow-y-auto`만 남으면 시트가 안 줄어든 채 통과한다.
    const scroller = screen.getByText('시트내용').parentElement as HTMLElement
    expect(scroller).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1')
  })
})
