import { useRef, type PointerEvent, type ReactNode } from 'react'
import { clampSheetRatio, nearestDetent, SHEET_RATIO } from '../../domain/sheet'

interface Props {
  readonly ratio: number
  readonly onRatioChange: (next: number) => void
  readonly top: ReactNode
  readonly bottom: ReactNode
}

// 이 컴포넌트는 Task 9에서 BottomSheet로 대체되며 사라진다. 그때까지만 서 있는
// 과도기 코드다.
//
// 주의: `ratio`는 위쪽(지도) 높이인데 SHEET_RATIO는 아래쪽(시트) 높이로
// 정의돼 있다 — 의미가 뒤집힌 채로 꽂혀 있다. 그래서 지금은 손잡이를 끝까지
// 내리면 시트가 92%가 되는 게 아니라 지도가 92%가 된다. 값을 뒤집지 않은
// 이유는 곧 지워질 파일에 손을 더 대지 않기 위해서다. BottomSheet는
// SHEET_RATIO를 제 뜻대로(시트 높이) 쓴다.
//
// 드래그 로직은 여기 있고 비율 계산은 domain/sheet.ts에 있다. 나눠 둔 이유는
// clamp·스냅을 제스처 없이 테스트하려는 것이다.
//
// 끄는 동안에는 clamp만 하고 놓을 때 스냅한다. 끄는 중에 붙이면 손잡이가
// 손끝을 벗어나 튄다.
//
// 토스 웹뷰에서 이 손잡이 드래그와 지도 팬 제스처가 충돌하는지는 실기기로만
// 확인된다 — STATE.md의 미해결 가정.
export function SplitPane({ ratio, onRatioChange, top, bottom }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 잡고 있는 포인터의 id. 두 손가락이 닿아도 처음 것만 손잡이를 움직인다.
  const pointerIdRef = useRef<number | null>(null)
  const movedRef = useRef(false)

  function ratioFromY(clientY: number): number | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.height === 0) {
      return null
    }
    return clampSheetRatio((clientY - rect.top) / rect.height)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== null) {
      return
    }
    pointerIdRef.current = event.pointerId
    movedRef.current = false
    // 손가락이 손잡이 밖으로 나가도 이벤트를 계속 받는다. jsdom에는 이
    // API가 없어서 옵셔널로 부른다.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    const next = ratioFromY(event.clientY)
    if (next === null) return
    movedRef.current = true
    onRatioChange(next)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointerIdRef.current = null

    // 누르기만 하고 끌지 않았으면 아무 일도 일어나면 안 된다. 손잡이를
    // 스치기만 해도 레이아웃이 튀면 목록을 스크롤하기 무서워진다.
    if (!movedRef.current) {
      return
    }
    movedRef.current = false
    const next = ratioFromY(event.clientY)
    if (next === null) return
    onRatioChange(SHEET_RATIO[nearestDetent(next)])
  }

  return (
    <div ref={containerRef} className="flex size-full flex-col overflow-hidden">
      <div style={{ height: `${ratio * 100}%` }} className="relative shrink-0">
        {top}
      </div>

      <div
        role="separator"
        aria-label="지도·목록 비율 조절"
        aria-orientation="horizontal"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onRatioChange(SHEET_RATIO.half)}
        className="flex h-5 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-outline-variant bg-surface-container"
      >
        <span className="h-1 w-9 rounded-full bg-outline" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{bottom}</div>
    </div>
  )
}
