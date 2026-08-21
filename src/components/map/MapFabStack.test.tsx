import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHEET_RATIO, type Detent } from '../../domain/sheet'
import { MapFabStack, type RecenterDetent } from './MapFabStack'

/** 이 묶음이 설 수 있는 단계 전부. `full`은 자리가 없어 타입에서 빠져 있다. */
const DETENTS: readonly RecenterDetent[] = ['peek', 'half']

/** 묶음 아래를 시트 상단보다 이만큼 위에 둔다(부모 높이 대비 비율). */
const GAP_RATIO = 0.02

// 「앱 공유」가 브리지를 부른다. 실제 함수를 두면 jsdom에 `navigator.share`가
// 없어 콘솔이 시끄럽고, 확인하려는 것은 공유가 나갔는지 하나다.
const shareMessage = vi.hoisted(() => vi.fn())
vi.mock('../../platform/links', () => ({
  shareMessage,
  openExternalUrl: vi.fn(),
}))

function renderStack(
  overrides: Partial<Parameters<typeof MapFabStack>[0]> = {},
): void {
  render(
    <MapFabStack
      favoritesOn={false}
      favoritesCount={0}
      onToggleFavorites={vi.fn()}
      recenterDisabled={false}
      detent="half"
      onRecenter={vi.fn()}
      {...overrides}
    />,
  )
}

describe('MapFabStack', () => {
  beforeEach(() => {
    shareMessage.mockClear()
  })

  // 셋이 한 묶음이라는 것이 보조기술에도 보여야 한다. 이름 없는 묶음이면
  // 화면 어딘가에 흩어진 버튼 셋으로 읽힌다.
  it('이름 있는 묶음 안에 셋이 선다', () => {
    renderStack()

    const group = screen.getByRole('group', { name: '지도 조작' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '내 장소 0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '앱 공유하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내 주변' })).toBeInTheDocument()
  })

  // 순서가 곧 손가락에서의 거리다. 「내 주변」이 가장 자주 눌리므로 엄지에
  // 가장 가까운 맨 아래이고, 위로 갈수록 덜 쓰는 것이 온다.
  it('내 주변이 맨 아래다', () => {
    renderStack()

    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['내 장소 0', '앱 공유하기', '내 주변'])
  })

  it('내 장소를 누르면 토글을 올려보낸다', async () => {
    const onToggleFavorites = vi.fn()
    renderStack({ onToggleFavorites })

    await userEvent.click(screen.getByRole('button', { name: '내 장소 0' }))

    expect(onToggleFavorites).toHaveBeenCalledTimes(1)
  })

  // **상태를 색으로만 말하지 않는다.** 아이콘뿐인 버튼이라 채워진 책갈피와
  // 빈 책갈피의 차이는 눈에만 보인다 — 이름과 `aria-pressed`가 같은 사실을
  // 소리로도 전한다.
  it('내 장소가 켜지면 이름과 눌림 상태가 함께 바뀐다', () => {
    renderStack({ favoritesOn: true, favoritesCount: 3 })

    const chip = screen.getByRole('button', { name: '내 장소 3 보는 중' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '내 장소 3' })).toBeNull()
  })

  // 칩 줄에 있을 때는 「내 장소 3」이라고 **적혀** 있었다. 아이콘뿐인 FAB으로
  // 옮기면서 그 수가 사라지지 않게 배지와 이름 양쪽에 싣는다.
  it('담은 개수를 배지와 이름 양쪽으로 말한다', () => {
    renderStack({ favoritesCount: 3 })

    const button = screen.getByRole('button', { name: '내 장소 3' })
    expect(button).toHaveTextContent('3')
    // 배지는 `aria-hidden`이라 이름에 두 번 들어가지 않는다.
    expect(button).toHaveAccessibleName('내 장소 3')
  })

  // 「0」짜리 배지는 눈에 띄는 값 없이 자리만 차지하고, 아직 아무것도 안 담은
  // 사람에게 뭔가 잘못됐다는 인상을 준다. 소리로는 여전히 개수를 말한다.
  it('담은 게 없으면 배지를 안 그리지만 이름은 0을 말한다', () => {
    renderStack({ favoritesCount: 0 })

    const button = screen.getByRole('button', { name: '내 장소 0' })
    expect(button).not.toHaveTextContent('0')
  })

  // 담은 곳이 하나도 없어도 눌려야 한다. 즐겨찾기 화면이 없어진 뒤로 「어떻게
  // 담는가」에 닿는 길이 이 버튼 하나뿐이고, 답은 눌러야 나오는 빈 목록
  // 문구에 있다 — 막으면 신규 사용자에게 그 기능이 앱에서 사라진다.
  it('좌표가 없어도 내 장소와 공유는 잠기지 않는다', () => {
    renderStack({ recenterDisabled: true })

    expect(screen.getByRole('button', { name: '내 장소 0' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '앱 공유하기' })).toBeEnabled()
  })

  // **명소가 아니라 앱을 보낸다.** 지도 화면에는 고른 명소가 없을 수도 있고,
  // 명소 공유는 상세 상단 바가 이미 맡는다. 링크에 `?area=`가 실리면 받은
  // 사람은 보낸 사람이 보지도 않던 곳으로 들어온다.
  it('앱 공유는 명소가 안 실린 뿌리 주소를 보낸다', async () => {
    renderStack()

    await userEvent.click(screen.getByRole('button', { name: '앱 공유하기' }))

    expect(shareMessage).toHaveBeenCalledTimes(1)
    const sent = shareMessage.mock.calls[0][0] as string
    expect(sent).toContain('서울 라이브')
    expect(sent).not.toContain('area=')
  })

  it('내 주변을 누르면 콜백을 부른다', async () => {
    const onRecenter = vi.fn()
    renderStack({ onRecenter })

    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))

    expect(onRecenter).toHaveBeenCalledTimes(1)
  })

  it('좌표가 없으면 비활성이고 눌러도 반응하지 않는다', async () => {
    // 위치 권한을 거부한 사용자가 눌렀을 때 아무 일도 안 일어나면 버튼이
    // 고장 난 것처럼 보인다. 비활성으로 만들어 누를 수 없음을 먼저 알린다.
    const onRecenter = vi.fn()
    renderStack({ recenterDisabled: true, onRecenter })

    const button = screen.getByRole('button', { name: '내 주변' })
    expect(button).toBeDisabled()

    await userEvent.click(button)
    expect(onRecenter).not.toHaveBeenCalled()
  })

  // 두 단계 모두 확인한다. 한 단계만 보면 위치를 상수로 박아 둔 구현도
  // 통과한다. 같은 z-20이고 시트가 DOM에서 뒤라, 올리지 않으면 시트가 이
  // 묶음을 덮는다.
  //
  // **묶음(`group`)에 붙는다.** 버튼마다 붙이면 셋이 같은 자리에 겹친다.
  it.each([
    ['peek', 'bottom-[18%]'],
    ['half', 'bottom-[58%]'],
  ] as ReadonlyArray<readonly [RecenterDetent, string]>)(
    '시트가 %s이면 %s에 선다',
    (detent, bottomClass) => {
      renderStack({ detent })
      expect(screen.getByRole('group', { name: '지도 조작' })).toHaveClass(bottomClass)
    },
  )

  // 넓은 화면에서는 시트가 왼쪽 패널이라 아래가 통째로 비고, 버튼은 화면
  // 아래 끝에서 일정 거리에 선다. **그 거리를 화면 끝에서 재면 안 된다** —
  // 가로로 든 폰(768px을 넘으므로 넓은 화면이다)에서는 그 끝이 홈 인디케이터라
  // 버튼이 그 밑으로 들어간다. 세로 단계의 `bottom-[%]`는 시트를 따라가므로
  // 이 문제가 없고, 여기만 따로 피해야 한다.
  it('시트가 없으면 홈 인디케이터를 피해 선다', () => {
    renderStack({ detent: null })
    expect(screen.getByRole('group', { name: '지도 조작' })).toHaveClass('bottom-safe-6')
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
  it.each(DETENTS)('%s 단계의 묶음 위치가 시트 높이에서 파생된다', (detent) => {
    renderStack({ detent })
    const className = screen.getByRole('group', { name: '지도 조작' }).className
    const found = className.match(/bottom-\[(\d+(?:\.\d+)?)%\]/)

    expect(found).not.toBeNull()
    // `detent`는 `RecenterDetent`(full 없음)라 `Detent` 키로 넓혀 읽는다.
    // 좁은 쪽으로 색인하면 TS가 「full이 빠졌다」고 막는다.
    expect(Number(found![1]) / 100).toBeCloseTo(
      SHEET_RATIO[detent as Detent] + GAP_RATIO,
      10,
    )
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
  it('묶음이 서는 단계가 시트 단계보다 하나 적다', () => {
    expect(DETENTS).toHaveLength(Object.keys(SHEET_RATIO).length - 1)
  })
})
