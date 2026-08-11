import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterChips } from './FilterChips'

const COUNTS = { fav: 3, kids: 10, date: 19, hot: 7 } as const

describe('FilterChips', () => {
  it('내 장소가 맨 앞이고 프리셋 셋이 순서대로 뒤따른다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)

    // 줄 전체를 고정한다. 첫 칸만 보면 뒤의 셋을 아무렇게나 섞어도 통과한다.
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '')
    expect(names).toEqual([
      expect.stringContaining('내 장소'),
      expect.stringContaining('아이와 나들이'),
      expect.stringContaining('데이트'),
      expect.stringContaining('지금 핫플'),
    ])
  })

  // 높이가 40px이라는 사실에 오버레이 예산이 걸려 있다. 「검색 바 + 칩 열」이
  // 화면 위 0~112px을 차지한다는 계산이 이 값에서 나오고(검색 바 64 + 간격 4 +
  // 이 줄 44 = 40px 칩 + 줄의 `pb-1`), 그 열이 full(92%)에서 손잡이 히트
  // 영역(컨테이너 800px 기준 44~88px)을 통째로 덮는다는 근거가 되어 「full에서는
  // 이 열을 그리지 않는다」로 이어진다. 48px 규약에 맞추려고 무심코 올리면
  // 그 사슬이 조용히 끊긴다.
  //
  // 112px은 Task 10에서 헤드리스 크롬으로 실측한 값이다. Task 9는 88px로
  // 적었는데 검색 바의 세로 패딩을 빠뜨린 오답이었다.
  it('칩 높이가 오버레이 예산에 맞춰 40px로 묶여 있다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: '내 장소 3' })).toHaveClass('min-h-10')
  })

  it('개수를 함께 보여준다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '내 장소 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '아이와 나들이 10' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '데이트 19' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '지금 핫플 7' })).toBeInTheDocument()
  })

  it('★는 눈에만 보이고 접근성 이름에는 들어가지 않는다', () => {
    // 「내 장소」가 이미 같은 말을 한다. ★를 이름에 넣으면 스크린리더가
    // "블랙 스타 내 장소 3"으로 읽는다.
    render(<FilterChips counts={COUNTS} value={null} onChange={vi.fn()} />)

    const chip = screen.getByRole('tab', { name: '내 장소 3' })
    expect(chip).toHaveTextContent('★')
    expect(chip).toHaveAccessibleName('내 장소 3')
  })

  it('0인 프리셋은 비활성이다', () => {
    render(
      <FilterChips counts={{ ...COUNTS, hot: 0 }} value={null} onChange={vi.fn()} />,
    )

    expect(screen.getByRole('tab', { name: '지금 핫플 0' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: '데이트 19' })).toBeEnabled()
  })

  it('0이어도 내 장소만은 누를 수 있다', async () => {
    // 프리셋의 0은 지금 그런 곳이 없다는 데이터 사정이라 눌러도 나올 말이
    // 없지만, 「내 장소」의 0은 아직 안 써 본 기능의 초기 상태다. 여기를
    // 막으면 즐겨찾기 화면과 함께 사라진 「어떻게 담는가」에 닿을 길이
    // 앱에서 완전히 없어진다 — 답은 이 칩을 눌러야 나오는 빈 목록 문구에 있다.
    const onChange = vi.fn()
    render(
      <FilterChips counts={{ ...COUNTS, fav: 0 }} value={null} onChange={onChange} />,
    )

    const chip = screen.getByRole('tab', { name: '내 장소 0' })
    expect(chip).toBeEnabled()

    await userEvent.click(chip)

    expect(onChange).toHaveBeenCalledWith('fav')
  })

  // 클릭 경로는 칩마다 따로 확인한다. 「내 장소」 하나로만 보면 어떤 칩을 눌러도
  // 'fav'를 올려보내는 구현이나, 즐겨찾기만 해제되고 프리셋은 안 꺼지는 구현이
  // 그대로 통과한다. 없어진 PresetFilter.test가 프리셋 쪽을 잡고 있었다.
  const CHIP_CASES = [
    { key: 'fav', name: '내 장소 3' },
    { key: 'kids', name: '아이와 나들이 10' },
    { key: 'date', name: '데이트 19' },
    { key: 'hot', name: '지금 핫플 7' },
  ] as const

  it.each(CHIP_CASES)('「$name」을 고르면 $key를 올려보낸다', async ({ key, name }) => {
    const onChange = vi.fn()
    render(<FilterChips counts={COUNTS} value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name }))

    expect(onChange).toHaveBeenCalledWith(key)
  })

  it.each(CHIP_CASES)('선택된 「$name」을 다시 누르면 해제된다', async ({ key, name }) => {
    const onChange = vi.fn()
    render(<FilterChips counts={COUNTS} value={key} onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('한 번에 하나만, 그것도 고른 그 칩만 선택된다', () => {
    render(<FilterChips counts={COUNTS} value="kids" onChange={vi.fn()} />)

    const tabs = screen.getAllByRole('tab')
    const selected = tabs.filter(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    )
    expect(selected).toHaveLength(1)
    // 개수만 세면 한 칸 밀린 칩을 칠해도 통과한다.
    expect(selected[0]).toHaveAccessibleName('아이와 나들이 10')
    // 나머지는 aria-selected가 빠진 게 아니라 false여야 한다.
    expect(
      tabs.filter((tab) => tab.getAttribute('aria-selected') === 'false'),
    ).toHaveLength(3)
  })

  it('비활성인 칩을 눌러도 값이 안 올라간다', async () => {
    const onChange = vi.fn()
    render(
      <FilterChips counts={{ ...COUNTS, hot: 0 }} value={null} onChange={onChange} />,
    )

    await userEvent.click(screen.getByRole('tab', { name: '지금 핫플 0' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('선택된 칩은 0이 돼도 해제할 수 있다', async () => {
    // 켜 둔 칩이 카테고리 축소나 시간대 변화로 0이 된다. 그때도 비활성으로
    // 굳으면 필터를 풀 방법이 사라져 빈 목록에 갇힌다.
    //
    // **소재가 `fav`이면 안 된다.** 「내 장소」는 `!selected`와 무관하게
    // 0에서도 활성이라(Task 10의 면제) 이 테스트가 **다른 이유로** 통과한다.
    // 실제로 Task 10 전까지 소재가 `fav`였고, 면제를 넣는 순간
    // `!selected`를 통째로 지워도 잡히지 않는 상태가 됐다.
    const onChange = vi.fn()
    render(<FilterChips counts={{ ...COUNTS, hot: 0 }} value="hot" onChange={onChange} />)

    const chip = screen.getByRole('tab', { name: '지금 핫플 0' })
    expect(chip).toBeEnabled()

    await userEvent.click(chip)

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
