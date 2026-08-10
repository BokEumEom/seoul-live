import { useRef, type PointerEvent, type ReactNode } from 'react'
import {
  clampSheetRatio,
  nearestDetent,
  SHEET_RATIO,
  type Detent,
} from '../../domain/sheet'

interface Props {
  readonly detent: Detent
  readonly onDetentChange: (next: Detent) => void
  readonly children: ReactNode
}

// 지도 위에 뜨는 오버레이 시트다. 공간을 나눠 갖지 않으므로 지도는 뒤에서
// 온전한 크기로 살아 있다. 높이는 부모 기준 비율이라 부모가 `relative`여야
// 하고, 부모의 높이가 곧 뷰포트여야 한다 — 얹는 쪽(Task 9)의 몫이다.
//
// 드래그는 손잡이에서만 받는다. 내용 영역에서도 받으면 full 단계에서 상세를
// 스크롤할 때마다 시트가 따라 내려간다.
//
// 끄는 동안에는 높이가 변하지 않고 손을 뗄 때 한 번에 단계로 붙는다. 단계
// 밖의 중간 높이를 표현할 수단이 이 인터페이스(`detent` 하나)에 없어서다.
// 손끝을 따라오게 하려면 시트가 제 높이를 따로 들고 있어야 하는데, 그 상태가
// 부모의 `detent`와 둘로 갈리는 쪽이 더 위험하다.
//
// 토스 웹뷰에서 이 드래그와 지도 팬 제스처가 충돌하는지는 실기기로만 확인된다
// — 설계 문서 §6.
export function BottomSheet({ detent, onDetentChange, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  // 잡고 있는 포인터의 id. 두 손가락이 닿아도 처음 것만 손잡이를 움직인다.
  const pointerIdRef = useRef<number | null>(null)
  // 끌었는지 여부만 기억한다. 좌표는 손을 떼는 순간에 한 번만 읽으므로,
  // 이 값이 참이라고 해서 그때 비율을 낼 수 있었다는 뜻은 아니다.
  const movedRef = useRef(false)

  function detentFromY(clientY: number): Detent | null {
    const rect = sheetRef.current?.parentElement?.getBoundingClientRect()
    if (rect === undefined || rect.height === 0) {
      return null
    }
    // 시트는 아래에 붙어 있다. 손끝이 위로 갈수록 높이가 커진다.
    return nearestDetent(clampSheetRatio((rect.bottom - clientY) / rect.height))
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
    // 좌표를 보지 않는다. 끄는 동안 높이가 변하지 않으니 여기서 비율을 낼
    // 이유가 없다 — 움직였다는 사실만 남긴다.
    movedRef.current = true
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    // 잡고 있지 않은 포인터가 떨어진 것이면 추적을 놓지 않는다. 두 번째
    // 손가락이 먼저 떨어졌다고 첫 손가락의 드래그를 버리면 안 된다.
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointerIdRef.current = null

    // 손잡이를 스치기만 해도 시트가 튀면 목록을 만지기 무서워진다.
    if (!movedRef.current) {
      return
    }
    movedRef.current = false
    const next = detentFromY(event.clientY)
    // 놓은 자리를 계산할 수 없으면(끄는 사이에 부모가 접혔다) 단계를 바꾸지
    // 않는다. 빠뜨린 게 아니라 고른 것이다 — 여기서 쓸 수 있는 다른 값은
    // 끌던 도중의 낡은 값뿐이고, 그건 손을 뗀 자리에 대한 추측이다. 사용자에게
    // "끌었는데 안 붙었다"로 보이는 편이 엉뚱한 단계로 튀는 것보다 낫다.
    if (next === null) return
    onDetentChange(next)
  }

  return (
    <div
      ref={sheetRef}
      style={{ height: `${SHEET_RATIO[detent] * 100}%` }}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-surface-container-lowest shadow-floating transition-[height] duration-200 ease-out"
    >
      <div
        role="separator"
        aria-label="시트 높이 조절"
        aria-orientation="horizontal"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onDetentChange('half')}
        className="flex shrink-0 cursor-row-resize touch-none justify-center py-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-outline-variant" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {children}
      </div>
    </div>
  )
}
