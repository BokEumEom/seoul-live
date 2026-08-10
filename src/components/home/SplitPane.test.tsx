import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SHEET_RATIO } from '../../domain/sheet'
import { SplitPane } from './SplitPane'

function setup(onRatioChange = vi.fn(), ratio = SHEET_RATIO.half) {
  render(
    <SplitPane
      ratio={ratio}
      onRatioChange={onRatioChange}
      top={<div>지도영역</div>}
      bottom={<div>목록영역</div>}
    />,
  )
  const handle = screen.getByRole('separator')
  // jsdom은 레이아웃을 계산하지 않아 높이가 0이다. 비율 계산이 0으로 나누지
  // 않도록 컨테이너 높이를 심는다.
  const container = handle.parentElement as HTMLElement
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
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
  return { handle, onRatioChange }
}

function drag(handle: HTMLElement, from: number, to: number): void {
  fireEvent.pointerDown(handle, { clientY: from, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientY: to, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientY: to, pointerId: 1 })
}

describe('SplitPane', () => {
  it('위아래 내용을 모두 그린다', () => {
    setup()
    expect(screen.getByText('지도영역')).toBeInTheDocument()
    expect(screen.getByText('목록영역')).toBeInTheDocument()
  })

  it('비율만큼 위쪽 높이를 준다', () => {
    setup(vi.fn(), 0.5)
    expect(screen.getByText('지도영역').parentElement).toHaveStyle({ height: '50%' })
  })

  it('손잡이를 끌어 놓으면 스냅점으로 붙는다', () => {
    const { handle, onRatioChange } = setup()
    drag(handle, 280, 560)
    // 560 / 800 = 0.7 → half(0.46)보다 full(0.92)이 가깝다
    expect(onRatioChange).toHaveBeenLastCalledWith(SHEET_RATIO.full)
  })

  it('끄는 도중에는 스냅하지 않고 손끝을 따라간다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 280, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 })
    // 400 / 800 = 0.5. 스냅점이 아니다 — 놓기 전에 붙어버리면 손잡이가 튄다.
    expect(onRatioChange).toHaveBeenLastCalledWith(0.5)
  })

  it('범위 밖으로 끌어도 한계 안에 머문다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 280, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 790, pointerId: 1 })
    expect(onRatioChange).toHaveBeenLastCalledWith(SHEET_RATIO.full)
    fireEvent.pointerMove(handle, { clientY: 10, pointerId: 1 })
    expect(onRatioChange).toHaveBeenLastCalledWith(SHEET_RATIO.peek)
  })

  it('끌지 않고 누르기만 하면 비율이 안 바뀐다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 280, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 280, pointerId: 1 })
    expect(onRatioChange).not.toHaveBeenCalled()
  })

  it('누르지 않고 지나가는 포인터는 무시한다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.pointerMove(handle, { clientY: 560, pointerId: 1 })
    expect(onRatioChange).not.toHaveBeenCalled()
  })

  it('다른 포인터의 움직임은 무시한다', () => {
    // 두 손가락이 닿으면 나중 것이 손잡이를 가로채면 안 된다.
    const { handle, onRatioChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 280, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 560, pointerId: 2 })
    expect(onRatioChange).not.toHaveBeenCalled()
  })

  it('더블클릭하면 기본값으로 돌아간다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.doubleClick(handle)
    expect(onRatioChange).toHaveBeenCalledWith(SHEET_RATIO.half)
  })

  it('손잡이에 접근 가능한 이름이 있다', () => {
    const { handle } = setup()
    expect(handle).toHaveAccessibleName('지도·목록 비율 조절')
  })
})
