import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterChips } from './FilterChips'

// `fav`는 이 줄에 안 그려진다(지도 FAB으로 갔다). 그래도 표에 남아 있는 것은
// 필터 한 칸을 여전히 나눠 쓰기 때문이다 — `Record<FilterKey, number>`가
// 요구하기도 한다.
const COUNTS = {
  fav: 3,
  calm: 12,
  normal: 9,
  busy: 5,
  crowded: 7,
  kids: 10,
  date: 19,
} as const

const TOTAL = 52

describe('FilterChips', () => {
  it('전체가 맨 앞이고 혼잡도 넷이 목적 앞에 선다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )

    // 줄 전체를 고정한다. 첫 칸만 보면 뒤의 여섯을 아무렇게나 섞어도 통과한다.
    //
    // **혼잡도가 목적보다 앞이다** — 목적 태그는 121곳 중 19곳에만 붙어 있고
    // 등급은 121곳 전부에 매 5분 들어온다. 그리고 「어디가 한산한가」가 이 앱의
    // 첫 질문이다.
    //
    // **이름이 등급 그 자체다.** 예전에는 「한적」(여유+보통)·「붐빔」 둘이었는데,
    // 칩은 「한적」이라 말하고 바로 아래 목록의 배지는 「여유」라 말했다.
    const names = screen.getAllByRole('button').map((chip) => chip.textContent ?? '')
    expect(names).toEqual([
      expect.stringContaining('전체'),
      expect.stringContaining('여유'),
      expect.stringContaining('보통'),
      expect.stringContaining('약간 붐빔'),
      expect.stringContaining('붐빔'),
      expect.stringContaining('아이와 나들이'),
      expect.stringContaining('데이트'),
    ])
  })

  // 「내 장소」가 이 줄을 떠난 것은 자리가 모자라서가 아니라 **혼잡도 넷이
  // 들어오면서 축이 갈렸기** 때문이다. 지도 FAB이 그 칩을 받았고, 담아 둔 곳에
  // 닿는 길은 그쪽 하나뿐이다(`MapFabStack`).
  it('내 장소는 이 줄에 없다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )

    expect(screen.queryByRole('button', { name: /내 장소/ })).toBeNull()
  })

  // 높이가 40px이라는 사실에 오버레이 예산이 걸려 있다. 「검색 바 + 칩 열」이
  // 화면 위 0~112px을 차지한다는 계산이 이 값에서 나오고(검색 바 64 + 간격 4 +
  // 이 줄 44 = 40px 칩 + 줄의 `pb-1`), 그 열이 full(92%)에서 손잡이 히트
  // 영역(컨테이너 800px 기준 44~88px)을 통째로 덮는다는 근거가 되어 「full에서는
  // 이 열을 그리지 않는다」로 이어진다. 48px 규약에 맞추려고 무심코 올리면
  // 그 사슬이 조용히 끊긴다.
  //
  // **칩이 일곱으로 늘어도 이 값은 그대로다** — 줄은 하나고 넘치는 만큼 가로로
  // 스크롤한다. 두 줄로 만들면 예산이 148px이 되어 위 계산을 다시 해야 한다.
  //
  // 112px은 Task 10에서 헤드리스 크롬으로 실측한 값이다. Task 9는 88px로
  // 적었는데 검색 바의 세로 패딩을 빠뜨린 오답이었다.
  it('칩 높이가 오버레이 예산에 맞춰 40px로 묶여 있다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '전체 52' })).toHaveClass('min-h-10')
  })

  it('개수를 함께 보여준다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '전체 52' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '여유 12' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '보통 9' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '약간 붐빔 5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '붐빔 7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '아이와 나들이 10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '데이트 19' })).toBeInTheDocument()
  })

  // 「전체」는 걸러지기 전의 수라 나머지 칩의 합보다 크다. 칩 개수를 그대로
  // 더해서 쓰면 등급을 모르는 명소(회색 「정보 없음」)가 어느 칩에도 안 걸려
  // 사라지고, 「전체 45」인데 목록에 52줄이 뜨는 화면이 된다.
  it('전체는 걸러지기 전의 수다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )

    const levelSum = COUNTS.calm + COUNTS.normal + COUNTS.busy + COUNTS.crowded
    expect(TOTAL).toBeGreaterThan(levelSum)
    expect(screen.getByRole('button', { name: `전체 ${TOTAL}` })).toBeInTheDocument()
  })

  // 색점은 혼잡도 칩에만 붙는다. 목적 칩은 혼잡도가 아니라 태그를 보므로
  // 찍을 색이 없다 — 넷에만 찍히는지 확인한다.
  it('혼잡도 칩에만 색점이 붙고 접근성 이름에는 안 들어간다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )

    const calm = screen.getByRole('button', { name: '여유 12' })
    expect(calm.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(calm).toHaveAccessibleName('여유 12')

    const kids = screen.getByRole('button', { name: '아이와 나들이 10' })
    expect(kids.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  // 고르면 칩이 primary로 차므로 점도 그 위에서 보이는 값으로 바뀌어야 한다.
  // 선명한 톤(`bg-calm` 등)은 파랑 위에서 1.2:1이라 사실상 사라진다.
  it('고른 혼잡도 칩의 색점은 파랑 위에서 보이는 값으로 바뀐다', () => {
    const { rerender } = render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: '여유 12' }).querySelector('.bg-calm'),
    ).not.toBeNull()

    rerender(
      <FilterChips counts={COUNTS} total={TOTAL} value="calm" onChange={vi.fn()} />,
    )
    expect(
      screen
        .getByRole('button', { name: '여유 12' })
        .querySelector('.bg-calm-container'),
    ).not.toBeNull()
  })

  it('0인 칩은 비활성이다', () => {
    render(
      <FilterChips
        counts={{ ...COUNTS, crowded: 0 }}
        total={TOTAL}
        value={null}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '붐빔 0' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '데이트 19' })).toBeEnabled()
  })

  // 목록이 0이어도 「전체」는 눌린다. 이 칩을 누르는 것은 거르는 조작이 아니라
  // **거르기를 그만두는** 조작이라, 막으면 필터를 풀 길이 「고른 칩을 다시
  // 누르기」 하나로 줄어든다.
  it('전체는 0이어도 누를 수 있다', async () => {
    const onChange = vi.fn()
    render(
      <FilterChips counts={COUNTS} total={0} value="date" onChange={onChange} />,
    )

    const chip = screen.getByRole('button', { name: '전체 0' })
    expect(chip).toBeEnabled()

    await userEvent.click(chip)

    expect(onChange).toHaveBeenCalledWith(null)
  })

  // 클릭 경로는 칩마다 따로 확인한다. 하나로만 보면 어떤 칩을 눌러도 같은 키를
  // 올려보내는 구현이 그대로 통과한다.
  const CHIP_CASES = [
    { key: 'calm', name: '여유 12' },
    { key: 'normal', name: '보통 9' },
    { key: 'busy', name: '약간 붐빔 5' },
    { key: 'crowded', name: '붐빔 7' },
    { key: 'kids', name: '아이와 나들이 10' },
    { key: 'date', name: '데이트 19' },
  ] as const

  it.each(CHIP_CASES)('「$name」을 고르면 $key를 올려보낸다', async ({ key, name }) => {
    const onChange = vi.fn()
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={onChange} />,
    )

    await userEvent.click(screen.getByRole('button', { name }))

    expect(onChange).toHaveBeenCalledWith(key)
  })

  it.each(CHIP_CASES)('선택된 「$name」을 다시 누르면 전체로 돌아간다', async ({ key, name }) => {
    const onChange = vi.fn()
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={key} onChange={onChange} />,
    )

    await userEvent.click(screen.getByRole('button', { name }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  // **탭이 아니라 토글 버튼 묶음이다.** `role="tab"`은 `tabpanel`과 짝을 이루고
  // `aria-controls`·화살표 이동·roving tabindex가 따라오는 패턴인데 이 칩 줄에는
  // 넷 다 없었다. 보조기술은 「탭 목록, 탭 1/7」이라 알리고 사용자는 오지 않는
  // 화살표 동작을 기대하게 된다 — 지키지 못할 약속이다.
  //
  // **「전체」 칩이 생겨 「반드시 하나」가 성립하는 지금도 `radiogroup`은
  // 아니다.** 그쪽도 화살표 이동을 요구하는데 이 줄에는 여전히 없다.
  it('탭이 아니라 눌림 상태를 가진 버튼 묶음이다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value="kids" onChange={vi.fn()} />,
    )

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByRole('group', { name: '필터' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '아이와 나들이 10' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('한 번에 하나만, 그것도 고른 그 칩만 선택된다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value="kids" onChange={vi.fn()} />,
    )

    const chips = screen.getAllByRole('button')
    const pressed = chips.filter(
      (chip) => chip.getAttribute('aria-pressed') === 'true',
    )
    expect(pressed).toHaveLength(1)
    // 개수만 세면 한 칸 밀린 칩을 칠해도 통과한다.
    expect(pressed[0]).toHaveAccessibleName('아이와 나들이 10')
    // 나머지는 aria-pressed가 빠진 게 아니라 false여야 한다.
    expect(
      chips.filter((chip) => chip.getAttribute('aria-pressed') === 'false'),
    ).toHaveLength(chips.length - 1)
  })

  // 아무것도 안 골랐을 때 눌려 있는 것은 「전체」다. 이 칩이 없던 때는 **아무
  // 칩도 안 눌린 상태**가 「전체」를 뜻했는데, 칩이 일곱이 되니 가로로 스크롤해
  // 일곱을 다 확인해야 그 사실을 알 수 있었다.
  it('아무것도 안 고르면 전체가 눌려 있다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value={null} onChange={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '전체 52' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  // 「내 장소」가 켜져 있으면 이 줄에는 눌린 칩이 하나도 없다. 그때 눌린 것은
  // 지도의 FAB이고, 여기서 「전체」까지 눌러 두면 **두 곳이 동시에 켜진 것처럼**
  // 보여 어느 쪽이 목록을 거르고 있는지 알 수 없게 된다.
  it('내 장소가 켜져 있으면 전체도 안 눌린다', () => {
    render(
      <FilterChips counts={COUNTS} total={TOTAL} value="fav" onChange={vi.fn()} />,
    )

    expect(
      screen
        .getAllByRole('button')
        .filter((chip) => chip.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(0)
  })

  it('비활성인 칩을 눌러도 값이 안 올라간다', async () => {
    const onChange = vi.fn()
    render(
      <FilterChips
        counts={{ ...COUNTS, crowded: 0 }}
        total={TOTAL}
        value={null}
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '붐빔 0' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('선택된 칩은 0이 돼도 해제할 수 있다', async () => {
    // 켜 둔 칩이 카테고리 축소나 시간대 변화로 0이 된다 — 한밤중에는 「붐빔」이
    // 실제로 0이다. 그때도 비활성으로 굳으면 필터를 풀 방법이 사라져 빈 목록에
    // 갇힌다.
    const onChange = vi.fn()
    render(
      <FilterChips
        counts={{ ...COUNTS, crowded: 0 }}
        total={TOTAL}
        value="crowded"
        onChange={onChange}
      />,
    )

    const chip = screen.getByRole('button', { name: '붐빔 0' })
    expect(chip).toBeEnabled()

    await userEvent.click(chip)

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
