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

  // 캡처 해제는 정리 작업이라 실패해도 할 일이 없다. 명세상
  // releasePointerCapture는 pointerId가 활성 포인터와 맞지 않으면
  // NotFoundError를 던진다 — `?.`는 부재만 막지 예외는 못 막는다. 여기서
  // 예외가 밖으로 나가면 아래의 상태 정리가 건너뛰어져 훨씬 나쁜 상태가 된다.
  // console.error도 넣지 않는다: 정상 경로(브라우저가 이미 캡처를 푼 뒤)에서도
  // 날 수 있어 소음만 남는다.
  function releaseCapture(event: PointerEvent<HTMLDivElement>): void {
    try {
      // jsdom에는 이 API가 아예 없어서 옵셔널로 부른다.
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // 이미 풀렸으면 그만이다.
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== null) {
      return
    }
    pointerIdRef.current = event.pointerId
    movedRef.current = false
    try {
      // 손가락이 손잡이 밖으로 나가도 이벤트를 계속 받는다.
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // 연결이 끊긴 엘리먼트면 InvalidStateError가 난다. 캡처 없이 추적만
      // 하면 손가락이 손잡이를 벗어나는 순간 이벤트가 끊겨 드래그가 반쯤 살아
      // 있게 된다. 시작하지 않은 것으로 되돌린다.
      pointerIdRef.current = null
    }
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
    // 내 상태를 먼저 정리하고 DOM은 그 뒤에 만진다. 순서가 반대면
    // releasePointerCapture가 던질 때 pointerIdRef가 non-null로 남고,
    // handlePointerDown의 `!== null` 가드가 이후 모든 드래그를 조용히 삼킨다.
    // 복구 경로가 없어서 손잡이가 세션 내내 죽는다.
    pointerIdRef.current = null
    releaseCapture(event)

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

  // 취소는 "여기서 놓았다"가 아니라 "이 제스처는 없던 일"이다. up과 같은
  // 핸들러를 물리면 취소가 곧 확정이 된다 — 이 시트는 끄는 동안 아무것도
  // 확정하지 않고 마지막 이벤트 하나로만 단계를 정하기 때문이다. 게다가
  // cancel의 clientY는 마지막 알려진 값이고 구현에 따라 0으로도 온다.
  // 0이면 비율이 (bottom - 0) / height = 1.0이라 full로 튄다. 손잡이 위아래가
  // 지도라 웹뷰가 제스처를 가져가며 cancel을 쏘는 건 상시 경로다 — 설계 §6.
  function handlePointerCancel(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    pointerIdRef.current = null
    movedRef.current = false
    releaseCapture(event)
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
        onPointerCancel={handlePointerCancel}
        onDoubleClick={() => onDetentChange('half')}
        // 손에 닿는 영역은 44px(WCAG 2.5.8), 눈에 보이는 띠는 4px 그대로다.
        // 30 + 4 + 10 = 44px 상자를 만들고 `-mt-5`로 레이아웃 몫을 원래의
        // 24px로 되돌린다 — 내용은 아래로 밀리지 않고 띠의 위치도 그대로다.
        //
        // 늘어난 20px을 위쪽에 몰아준 이유가 둘이다. (1) 아래로 늘리면 그
        // 영역을 내용 래퍼가 덮는다 — 형제 중 뒤에 있어 hit test에서 이긴다.
        // 늘려도 손에 닿지 않는다. (2) 손잡이 위가 지도라 빗나간 터치는 위로
        // 벗어난다. 그걸 지도 팬이 아니라 시트가 받게 하는 게 목적이다.
        className="-mt-5 flex shrink-0 cursor-row-resize touch-none justify-center pt-7.5 pb-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-outline-variant" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {children}
      </div>
    </div>
  )
}
