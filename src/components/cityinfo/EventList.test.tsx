import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CulturalEvent } from '../../domain/cityInfo'
import { makeCulturalEvent } from '../../test/cityInfo'
import { EventList } from './EventList'

function event(overrides: Partial<CulturalEvent> = {}): CulturalEvent {
  return makeCulturalEvent({
    name: '서울 야외도서관',
    period: '2026-08-20~2026-08-24',
    place: '광화문광장',
    url: 'https://culture.seoul.go.kr/1',
    thumbnail: 'https://culture.seoul.go.kr/cmmn/file/getImage.do?atchFileId=abc',
    coords: { lat: 37.5715, lng: 126.9769 },
    ...overrides,
  })
}

const noop = () => undefined

describe('EventList', () => {
  // **기간과 장소가 서로 다른 줄이다**(2026-08-25, 시안 `_7`). 점으로 이어
  // 붙이면 「2026-08-18~2026-08-28 · 광화문광장 (서울특별시 종로구 세종대로
  // 175)」이 390px에서 접히면서 어디까지가 날짜인지가 안 보인다.
  it('이름·기간·장소를 저마다의 줄에 적는다', () => {
    render(<EventList events={[event()]} onShowOnMap={noop} />)

    expect(screen.getByText('서울 야외도서관')).toBeInTheDocument()
    expect(screen.getByText('2026-08-20~2026-08-24')).toBeInTheDocument()
    expect(screen.getByText('광화문광장')).toBeInTheDocument()
    expect(screen.queryByText('2026-08-20~2026-08-24 · 광화문광장')).toBeNull()
  })

  /**
   * **빈 줄은 글자가 없어서 글자로는 못 잡는다.** 가드를 지워도
   * `queryByText`로는 아무 일이 없어 보이는데(2026-08-25 변이 실험에서 실제로
   * 살아남았다), 화면에는 **값 없는 시계 아이콘**이 덩그러니 남는다.
   *
   * `FacilityFact`는 `<p>` 안에 글리프를 담고 지도 버튼은 `<button>` 안에
   * 담으므로, `p svg`를 세면 사실 줄만 세어진다.
   */
  it('기간이 비면 그 줄을 통째로 만들지 않는다', () => {
    const { container } = render(
      <EventList events={[event({ period: '' })]} onShowOnMap={noop} />,
    )

    expect(container.querySelectorAll('li p svg')).toHaveLength(1)
    expect(screen.getByText('광화문광장')).toBeInTheDocument()
  })

  it('장소가 비면 그 줄을 통째로 만들지 않는다', () => {
    const { container } = render(
      <EventList events={[event({ place: '' })]} onShowOnMap={noop} />,
    )

    expect(container.querySelectorAll('li p svg')).toHaveLength(1)
    expect(screen.getByText('2026-08-20~2026-08-24')).toBeInTheDocument()
  })

  // **한 행사가 한 카드다.** 테두리가 없으면 포스터가 있는 행사와 없는 행사가
  // 섞였을 때 어디서 하나가 끝나고 다음이 시작하는지가 안 보인다 — 그림이
  // 구분선 노릇을 하다가 그림 없는 항목에서 그 노릇이 사라진다.
  it('행사마다 테두리를 두른 카드를 만든다', () => {
    render(
      <EventList
        events={[event({ name: '첫째' }), event({ name: '둘째', thumbnail: '' })]}
        onShowOnMap={noop}
      />,
    )
    const cards = screen.getAllByRole('listitem')

    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.className).toMatch(/\bborder\b/)
    }
  })

  // 시안 `_7`이 카드마다 그리는 그림이다. 실호출 53건 전부에 있었다.
  it('대표 이미지를 건다', () => {
    const { container } = render(<EventList events={[event()]} onShowOnMap={noop} />)
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://culture.seoul.go.kr/cmmn/file/getImage.do?atchFileId=abc',
    )
  })

  it('그림이 없어도 나머지를 그린다', () => {
    const { container } = render(
      <EventList events={[event({ thumbnail: '' })]} onShowOnMap={noop} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('서울 야외도서관')).toBeInTheDocument()
  })

  // **`EVENT_PLACE`가 「더 갤러리 호수」처럼 아는 사람만 아는 이름으로 온다.**
  // 시안 `_7`의 「지도에서 보기」가 그걸 대신한다.
  it('좌표가 있으면 지도로 보낸다', async () => {
    const onShowOnMap = vi.fn()
    render(<EventList events={[event()]} onShowOnMap={onShowOnMap} />)

    await userEvent.click(screen.getByRole('button', { name: /지도에서 보기/ }))

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '서울 야외도서관',
      coords: { lat: 37.5715, lng: 126.9769 },
    })
  })

  // 눌러도 아무 일이 안 일어나는 버튼은 고장으로 보인다(`ShowOnMapButton`).
  it('좌표가 없으면 지도 버튼을 만들지 않는다', () => {
    render(<EventList events={[event({ coords: null })]} onShowOnMap={noop} />)
    expect(screen.queryByRole('button', { name: /지도에서 보기/ })).toBeNull()
  })

  // 웹뷰 밖으로 나가는 링크다. opener를 남기면 열린 페이지가 이쪽 window를
  // 조작할 수 있다.
  it('상세 링크는 새 창으로 열고 opener를 끊는다', () => {
    render(<EventList events={[event()]} onShowOnMap={noop} />)
    const link = screen.getByRole('link', { name: '서울 야외도서관' })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('링크가 없으면 글자만 남는다', () => {
    render(<EventList events={[event({ url: '' })]} onShowOnMap={noop} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('서울 야외도서관')).toBeInTheDocument()
  })

  // **실호출 53건 중 45건이 `null`이었다.** 모르는 값을 「유료」로도 「무료」로도
  // 적지 않는다.
  it('유무료를 모르면 아무 말도 안 한다', () => {
    render(<EventList events={[event()]} onShowOnMap={noop} />)

    expect(screen.queryByText('무료')).toBeNull()
    expect(screen.queryByText('유료')).toBeNull()
  })

  it('무료 여부를 알면 적는다', () => {
    const { unmount } = render(
      <EventList events={[event({ free: true })]} onShowOnMap={noop} />,
    )
    expect(screen.getByText('무료')).toBeInTheDocument()
    unmount()

    render(<EventList events={[event({ free: false })]} onShowOnMap={noop} />)
    expect(screen.getByText('유료')).toBeInTheDocument()
  })

  // 같은 이름의 행사가 장소만 달리해 여러 건 올 수 있다.
  it('같은 이름이 여러 건 와도 모두 그린다', () => {
    render(
      <EventList
        events={[event(), event({ place: '서울광장' })]}
        onShowOnMap={noop}
      />,
    )
    expect(screen.getAllByText('서울 야외도서관')).toHaveLength(2)
  })
})
