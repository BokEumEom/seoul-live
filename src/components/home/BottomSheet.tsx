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

// 손잡이를 누를 때마다 한 칸씩 굴러간다. full에서 peek으로 돌아 순환을 닫는
// 이유는 어느 단계에서도 나머지 둘에 닿게 하기 위해서다 — 한쪽 끝에서 멈추면
// 그 단계가 막다른 골목이 된다.
const NEXT_DETENT: Readonly<Record<Detent, Detent>> = {
  peek: 'half',
  half: 'full',
  full: 'peek',
}

// 스크린리더 사용자는 시트가 지금 얼마나 열려 있는지 볼 수 없다. 누르면
// 무엇이 될지는 현재 단계를 알아야 예측되므로 이름에 담는다.
const DETENT_LABEL: Readonly<Record<Detent, string>> = {
  peek: '살짝 열림',
  half: '절반',
  full: '전체',
}

// 지도 위에 뜨는 오버레이 시트다. 공간을 나눠 갖지 않으므로 지도는 뒤에서
// 온전한 크기로 살아 있다. 높이는 부모 기준 비율이라 부모가 `relative`여야
// 하고, 부모의 높이가 곧 뷰포트여야 한다 — 얹는 쪽(Task 9)의 몫이다.
//
// 드래그는 손잡이에서만 받는다. 내용 영역에서도 받으면 full 단계에서 상세를
// 스크롤할 때마다 시트가 따라 내려간다. 손잡이는 끌 수도 있고 누를 수도 있다 —
// 누르면 peek→half→full→peek으로 한 칸씩 굴러간다.
//
// 높이를 `transition-[height]`로 바꾼다. 계획서는 이것이 스크롤 위치를 버린다고
// 봤지만 헤드리스 크롬으로 재 보니 아니었다: full(scrollTop 300)→peek→full
// 왕복에서 300이 그대로 남는다. 줄어드는 쪽은 clientHeight가 작아져 maxScrollTop이
// **커지므로** 잘릴 것이 없다. peek에서 스크롤을 끝까지 만졌을 때만 잘리는데
// (2896→2288) 그건 끝 너머를 보여줄 수 없어 옳은 동작이다. 제안됐던 「높이 고정 +
// translateY」 대안은 오히려 peek에서 clientHeight가 92%로 남아 끝까지 내려도
// 608px어치 내용에 영원히 닿지 못한다. 남은 것은 매 프레임 리플로우라는 성능
// 논거뿐이고, 그건 실기기 없이 판단할 수 없다.
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
  // 방금 끝난 제스처가 드래그였는지. `movedRef`를 그대로 쓸 수 없다 —
  // handlePointerUp이 단계를 정하면서 그것을 되돌려 놓으므로 뒤따라오는
  // click이 도착할 때는 이미 거짓이다. 클릭 핸들러가 소비할 몫이 따로 있어야
  // 끌어서 붙인 단계가 곧바로 한 칸 더 굴러가는 일이 없다.
  const draggedRef = useRef(false)

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
  function releaseCapture(event: PointerEvent<HTMLButtonElement>): void {
    try {
      // jsdom에는 이 API가 아예 없어서 옵셔널로 부른다.
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // 이미 풀렸으면 그만이다.
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (pointerIdRef.current !== null) {
      return
    }
    pointerIdRef.current = event.pointerId
    movedRef.current = false
    // 앞선 제스처가 남긴 클릭 가드를 여기서 턴다. 소비에만 기대면 드래그 뒤
    // click이 오지 않는 경로(브라우저가 삼키는 경우)에서 가드가 참으로 굳어
    // 그다음 탭 한 번이 통째로 먹힌다 — 사용자에게는 손잡이가 한 번 죽는다.
    draggedRef.current = false
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

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    // 좌표를 보지 않는다. 끄는 동안 높이가 변하지 않으니 여기서 비율을 낼
    // 이유가 없다 — 움직였다는 사실만 남긴다.
    movedRef.current = true
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>): void {
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
    // 계산이 실패해 단계를 안 바꾸는 경우에도 세워 둔다. 끈 것은 끈 것이고,
    // 뒤따라오는 click은 "끌지 않았을 때만" 단계를 굴려야 한다.
    draggedRef.current = true
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
  function handlePointerCancel(event: PointerEvent<HTMLButtonElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    pointerIdRef.current = null
    movedRef.current = false
    // 없던 일이 된 제스처는 드래그도 아니다. 취소 뒤에는 click이 오지 않는 게
    // 보통이지만, 남겨 두면 그다음 탭이 삼켜진다.
    draggedRef.current = false
    releaseCapture(event)
  }

  // 보조기술이 시트 단계를 바꿀 수 있는 유일한 통로다. role="separator"는
  // ARIA상 구조적 구분선이라 TalkBack/VoiceOver가 실행 동작을 주지 않고,
  // 예전에 있던 onDoubleClick도 두 번 탭이 dblclick이 아니라 click을 쏘므로
  // 닿지 않았다. tabindex만 얹어 separator를 유지하는 길은 택하지 않는다 —
  // 그러면 aria-valuenow/min/max가 따라와야 하는데 이 시트에는 splitter가
  // 가르는 두 pane이 애초에 없다(SplitPane에는 있었다). 한 손 조작에도 이득이다.
  function handleClick(): void {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    onDetentChange(NEXT_DETENT[detent])
  }

  return (
    <div
      ref={sheetRef}
      style={{ height: `${SHEET_RATIO[detent] * 100}%` }}
      // 여기에 `overflow-hidden`을 걸지 마라. 손잡이의 히트 영역이 이 상자
      // 위로 20px 나가 있어서 조용히 잘린다 — 아래 손잡이 주석을 볼 것.
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-surface-container-lowest shadow-floating transition-[height] duration-200 ease-out"
    >
      <button
        type="button"
        aria-label={`시트 높이 조절, 현재 ${DETENT_LABEL[detent]}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        // `w-full`이 빠지면 안 된다. button은 기본이 inline-block이라 히트
        // 영역이 4px짜리 띠 폭으로 쪼그라든다 — div였을 때는 공짜로 얻던 것이다.
        //
        // 손에 닿는 영역은 44px(WCAG 2.5.8), 눈에 보이는 띠는 4px 그대로다.
        // 30 + 4 + 10 = 44px 상자를 만들고 `-mt-5`로 레이아웃 몫을 원래의
        // 24px로 되돌린다 — 내용은 아래로 밀리지 않고 띠의 위치도 그대로다.
        //
        // 늘어난 20px을 위쪽에 몰아준 이유가 둘이다. (1) 아래로 늘리면 그
        // 영역을 내용 래퍼가 덮는다 — 형제 중 뒤에 있어 hit test에서 이긴다.
        // 늘려도 손에 닿지 않는다. (2) 손잡이 위가 지도라 빗나간 터치는 위로
        // 벗어난다. 그걸 지도 팬이 아니라 시트가 받게 하는 게 목적이다.
        //
        // 그 대가로 시트 위 20px 띠에서는 지도가 죽는다 — `touch-none` 상자라
        // 그 띠의 마커 탭도 지도 팬도 먹지 않는다. 의도한 교환이지만 공짜는
        // 아니다. peek(16%)에서는 화면 84% 지점을 가로지르는 죽은 띠가 된다.
        //
        // 그리고 이 20px은 시트 루트 밖으로 나가 있다. 루트에 `overflow-hidden`을
        // 걸면 조용히 잘려 히트 영역이 24px로 돌아간다 — 테스트도 못 잡는다.
        // 상단 요소가 둥근 모서리를 삐져나오거든 루트를 덮지 말고 그 요소를
        // 깎아라.
        className="-mt-5 flex w-full shrink-0 cursor-row-resize touch-none justify-center pt-7.5 pb-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-outline-variant" />
      </button>

      {/* **여기에 padding을 걸지 마라.** 시트에 들어오는 뷰 셋(목록·상세·
          오늘의 서울)이 이미 저마다 `px-4`·`mx-4`·`pb-6`을 들고 있어서, 여기서
          한 겹 더 주면 32px로 겹친다. 그리고 상세의 히어로처럼 가로를 꽉
          채워야 하는 요소는 바깥 여백이 있으면 표현할 방법이 없다.
          여백의 주인은 시트가 아니라 뷰다 — 테스트가 이 규칙을 잠근다.

          `data-sheet-content`는 그 테스트의 손잡이다. 자식 텍스트에서
          `.parentElement`로 거슬러 오르면, 뷰가 자기 내용을 한 겹 감싸는
          순간 엉뚱한 요소를 검사하면서 조용히 통과한다. */}
      <div
        data-sheet-content
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
    </div>
  )
}
