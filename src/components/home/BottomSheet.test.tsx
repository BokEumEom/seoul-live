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
  return {
    // 손잡이는 구분선이 아니라 버튼이다 — 이름은 현재 단계까지 담으므로
    // 정규식으로 잡는다.
    handle: screen.getByRole('button', { name: /시트 높이 조절/ }),
    // 스크롤 컨테이너. 자식 텍스트의 `.parentElement`로 잡지 않는다 — 뷰가
    // 자기 내용을 한 겹 감싸면 그 래퍼를 검사하면서 조용히 통과한다.
    scroller: sheet.querySelector('[data-sheet-content]') as HTMLElement,
    onDetentChange,
    sheet,
    setViewportHeight,
  }
}

/** 요소에 걸린 Tailwind padding 유틸리티를 전부 모은다.
 *
 * 클래스 이름을 세는 이유: jsdom에는 Tailwind 스타일시트가 없어서
 * `getComputedStyle`이 `px-4`가 있든 없든 언제나 0px을 돌려준다 — 계산값으로
 * 재는 테스트는 절대 실패하지 못하는 죽은 테스트가 된다.
 *
 * `px-4` 하나만 찍어 보지 않는 이유: `p-4`나 `pl-4 pr-4`로 여백이 돌아오면
 * 그 단언은 못 잡는다. 잠그려는 것은 「이 클래스가 없다」가 아니라
 * 「여백이 없다」다. `p` 뒤에 방향 한 글자(있어도 되고 없어도 된다)와 `-`가
 * 오는 것만 센다 — `place-items-*`·`pointer-events-*`·`peer`는 걸리지 않는다. */
function paddingClasses(element: HTMLElement): readonly string[] {
  return element.className.split(/\s+/).filter((cls) => /^-?p[trblxyse]?-/.test(cls))
}

// 한 id로 down→move→up 한 벌이 온전히 오는 표준 시퀀스. 제스처 **사이**에
// id가 바뀌는 건 `pointerId` 옵션으로 표현한다.
//
// 이걸 쓰지 않는 테스트는 셋이다. (a) 일부만 쏘는 것 — 누르기만/지나가기만,
// 취소로 끝나는 것. (b) 중간에 다른 걸 끼우는 것 — 뷰포트를 접거나 남의
// 포인터를 떨어뜨리는 것. (c) **한 시퀀스 안에서** id가 섞이는 것. 셋 다
// 어떤 이벤트가 어떤 id로 오느냐가 곧 검증 대상이라 펼쳐 써야 읽힌다.
function drag(
  handle: HTMLElement,
  from: number,
  to: number,
  options: { readonly release?: number; readonly pointerId?: number } = {},
): void {
  const { release = to, pointerId = 1 } = options
  fireEvent.pointerDown(handle, { clientY: from, pointerId })
  fireEvent.pointerMove(handle, { clientY: to, pointerId })
  fireEvent.pointerUp(handle, { clientY: release, pointerId })
}

// 세 단계 모두를 확인한다. 한 단계만 보면 높이를 상수로 박아 둔 구현도 통과한다.
const HEIGHT: ReadonlyArray<readonly [Detent, string]> = [
  ['peek', '16%'],
  ['half', '56%'],
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
    drag(handle, 430, 100, { release: 700 })
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
    // 두 번째 제스처는 반드시 새 id로 와야 한다. 실제 터치는 취소된 포인터의
    // id를 재사용하지 않고, 같은 id로 끌면 상한 추적 상태(`pointerIdRef`가 1로
    // 남은 것)를 move·up 가드가 그대로 통과해 버려 결과가 정상과 똑같아진다 —
    // 일어나지 않는 경우를 검증하면서 일어나는 경우를 놓치게 된다.
    drag(handle, 430, 100, { pointerId: 2 })
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('캡처 해제가 던져도 손잡이는 살아 있다', () => {
    // 잠그는 것은 try/catch의 존재가 아니라 "정리가 던져도 다음 제스처가
    // 여전히 먹는다"는 결과다. 목은 던지는 브라우저라는 전제를 공급하는
    // 픽스처일 뿐 검증 대상이 아니다. 명세상 releasePointerCapture는 pointerId가
    // 활성 포인터와 맞지 않으면 NotFoundError를 던진다.
    const { handle, onDetentChange } = setup()
    handle.releasePointerCapture = () => {
      throw new DOMException('not an active pointer', 'NotFoundError')
    }
    drag(handle, 430, 100)
    drag(handle, 430, 700, { pointerId: 2 })
    expect(onDetentChange).toHaveBeenCalledTimes(2)
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

  it('두 번째 손가락이 닿아도 손잡이는 첫 손가락을 따른다', () => {
    // "두 손가락이 닿아도 처음 것만 손잡이를 움직인다"는 규칙에 정작 두 번째
    // pointerdown을 쏘는 테스트가 없었다. 가드를 빼도 아무도 못 잡았다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerDown(handle, { clientY: 600, pointerId: 2 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('다른 포인터가 취소돼도 잡고 있던 손가락은 계속 끈다', () => {
    // 웹뷰가 두 번째 손가락의 제스처만 가져가는 경우다. 그걸 내 취소로 받으면
    // 잡고 있던 손가락이 손끝 아래에서 죽는다. up 쪽에는 같은 뜻의 테스트가
    // 있었지만 cancel 쪽에는 없었다.
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerCancel(handle, { clientY: 700, pointerId: 2 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('캡처를 못 잡으면 드래그를 시작하지 않는다', () => {
    // setPointerCapture가 던지면(연결이 끊긴 엘리먼트면 InvalidStateError다)
    // 캡처 없이 추적만 남는다 — 손가락이 손잡이를 벗어나는 순간 이벤트가 끊겨
    // 드래그가 반쯤 살아 있게 된다. 시작하지 않은 것으로 되돌려야 한다.
    // 위 「캡처 해제가 던져도」와 대칭이다.
    const { handle, onDetentChange } = setup()
    handle.setPointerCapture = () => {
      throw new DOMException('detached', 'InvalidStateError')
    }
    drag(handle, 430, 100)
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

  // 손잡이는 보조기술로도 조작 가능해야 한다. role="separator"는 ARIA상
  // 구조적 구분선이라 TalkBack/VoiceOver가 실행 동작을 주지 않고, 남아 있던
  // onDoubleClick도 TalkBack의 두 번 탭이 click을 쏘므로 닿지 않았다.
  // 그래서 진짜 button이고, 누르면 단계가 한 칸씩 굴러간다.
  it.each([
    ['peek', 'half'],
    ['half', 'full'],
    ['full', 'peek'],
  ] as ReadonlyArray<readonly [Detent, Detent]>)(
    '%s → %s: 손잡이를 누르면 한 칸 굴러간다',
    (from, to) => {
      const { handle, onDetentChange } = setup(vi.fn(), from)
      fireEvent.click(handle)
      expect(onDetentChange).toHaveBeenCalledTimes(1)
      expect(onDetentChange).toHaveBeenLastCalledWith(to)
    },
  )

  it('끌어서 놓은 뒤 따라오는 클릭은 단계를 한 칸 더 굴리지 않는다', () => {
    // 드래그 뒤에도 click은 그대로 발생한다. 소비하지 않으면 손을 뗀 자리로
    // 붙자마자 곧바로 다음 단계로 넘어가 손잡이가 제멋대로 움직인다.
    const { handle, onDetentChange } = setup()
    drag(handle, 430, 100)
    fireEvent.click(handle)
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('끈 다음 제스처의 탭은 다시 먹는다', () => {
    // 클릭 가드를 소비로만 풀면, 드래그 뒤 click이 오지 않는 경로에서 가드가
    // 참으로 굳어 그다음 탭 한 번이 통째로 삼켜진다.
    const { handle, onDetentChange } = setup()
    drag(handle, 430, 100)
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 2 })
    fireEvent.pointerUp(handle, { clientY: 430, pointerId: 2 })
    fireEvent.click(handle)
    expect(onDetentChange).toHaveBeenCalledTimes(2)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('취소된 제스처 뒤의 탭도 단계를 바꾼다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerCancel(handle, { clientY: 100, pointerId: 1 })
    fireEvent.click(handle)
    expect(onDetentChange).toHaveBeenCalledTimes(1)
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  // 스크린리더 사용자는 시트 높이를 볼 수 없다. 누르면 무엇이 될지는 현재
  // 단계를 알아야만 예측된다. setup은 매번 새로 render하므로 한 테스트 안에서
  // 세 번 부르면 손잡이가 셋이 되어 쿼리가 터진다 — it.each로 나눈다.
  it.each([
    ['peek', '살짝 열림'],
    ['half', '절반'],
    ['full', '전체'],
  ] as ReadonlyArray<readonly [Detent, string]>)(
    '%s 단계의 손잡이 이름이 「%s」이라고 말한다',
    (detent, label) => {
      const { handle } = setup(vi.fn(), detent)
      expect(handle).toHaveAccessibleName(`시트 높이 조절, 현재 ${label}`)
    },
  )

  it('손잡이가 시트 폭 전체를 받는다', () => {
    // button은 기본이 inline-block이라 w-full이 없으면 히트 영역이 4px짜리
    // 띠 폭으로 쪼그라든다. div였을 때는 공짜로 얻던 것이다.
    const { handle } = setup()
    expect(handle).toHaveClass('w-full')
  })

  // 가로(`w-full`)만 잠그고 세로는 안 잠가 뒀었다. 히트 영역이 44px(WCAG 2.5.8)이
  // 되는 것은 `pt-7.5`(30) + 띠 4 + `pb-2.5`(10)이고, `-mt-5`는 늘어난 20px의
  // **레이아웃 몫만** 되돌려 내용이 밀리지 않게 한다. 셋 중 하나만 빠져도
  // 히트 영역이 24px로 돌아간다.
  //
  // **잘린 높이 자체는 jsdom이 못 잰다** — 레이아웃이 없다. 잡을 수 있는 것은
  // 그 값을 만드는 클래스이고, 이것이 `w-full`과 같은 급의 계약이다.
  it('손잡이의 세로 히트 영역이 위로 20px 늘어나 있다', () => {
    const { handle } = setup()
    expect(handle).toHaveClass('-mt-5', 'pt-7.5', 'pb-2.5')
  })

  it('시트 루트가 손잡이의 넘친 히트 영역을 잘라내지 않는다', () => {
    // 늘어난 20px은 시트 루트 **밖으로** 나가 있다. 루트에 `overflow-hidden`을
    // 걸면 조용히 잘려 히트 영역이 24px로 돌아간다 — 화면에는 아무 변화가
    // 없어서 눈으로도 안 보인다.
    const { sheet } = setup()
    expect(sheet).not.toHaveClass('overflow-hidden')
  })

  it('내용 영역이 스크롤된다', () => {
    const { scroller } = setup()
    // 손잡이는 고정이고 내용만 흐른다 — full에서 상세를 스크롤할 때
    // 시트가 따라 내려가면 안 된다.
    //
    // `min-h-0`·`flex-1`까지 함께 건다. 실제로 넘치는 내용을 줄여 주는 건
    // 이 둘이고, `overflow-y-auto`만 남으면 시트가 안 줄어든 채 통과한다.
    expect(scroller).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1')
    expect(scroller).toContainElement(screen.getByText('시트내용'))
  })

  it('여백은 시트가 아니라 내용 뷰가 소유한다', () => {
    // 시트에 들어오는 뷰 셋(목록·상세·오늘의 서울)이 이미 저마다 `px-4`·`mx-4`·
    // `pb-6`을 들고 있다. 시트가 한 겹 더 주면 좌우가 32px로 겹치고, 상세
    // 히어로처럼 가로를 꽉 채워야 하는 요소는 표현할 길이 사라진다.
    //
    // 계획서를 뒤집은 결정이라(계획서는 "여백은 시트가 준다"였다) 잠금이
    // 없으면 다음에 누가 되돌려도 아무도 못 막는다.
    const { scroller } = setup()
    expect(paddingClasses(scroller)).toEqual([])
  })
})
