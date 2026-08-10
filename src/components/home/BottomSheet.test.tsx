import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Detent } from '../../domain/sheet'
import { BottomSheet } from './BottomSheet'

function setup(onDetentChange = vi.fn(), detent: Detent = 'half') {
  const { container } = render(
    <BottomSheet detent={detent} onDetentChange={onDetentChange}>
      <div>시트내용</div>
    </BottomSheet>,
  )
  const sheet = container.firstElementChild as HTMLElement
  // jsdom은 레이아웃을 계산하지 않는다. 비율 계산이 0으로 나누지 않도록 심는다.
  vi.spyOn(sheet.parentElement as HTMLElement, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    height: 800,
    bottom: 800,
    left: 0,
    right: 0,
    width: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  return { handle: screen.getByRole('separator'), onDetentChange, sheet }
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
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    // 아래에서 100px 남은 지점 = 시트 높이 700/800 = 0.875 → full(0.92)에 가장 가깝다
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('아래로 끌어 놓으면 peek이 된다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 700, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 700, pointerId: 1 })
    expect(onDetentChange).toHaveBeenLastCalledWith('peek')
  })

  it('끌던 도중이 아니라 놓은 자리가 단계를 정한다', () => {
    // 위로 끌었다가 마음을 바꿔 도로 내리고 놓은 경우. 지나간 자리가 아니라
    // 손을 뗀 자리가 답이어야 한다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 700, pointerId: 1 })
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('peek')
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
    const scroller = screen.getByText('시트내용').parentElement as HTMLElement
    expect(scroller.className).toContain('overflow-y-auto')
  })
})
