import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyLanguage } from '../../i18n/t'
import type { AccidentControl } from '../../domain/accident'
import { makeAccident } from '../../test/cityInfo'
import { AccidentList } from './AccidentList'

function accident(overrides: Partial<AccidentControl> = {}): AccidentControl {
  return makeAccident({
    info: '세종대로 사거리 2개 차로 통제',
    type: '교통사고',
    detailType: '차대차',
    occurredAt: '2026-08-07 08:40',
    expectedClearAt: '2026-08-07 10:00',
    ...overrides,
  })
}

const noop = () => {}

afterEach(() => {
  applyLanguage('ko')
})

describe('AccidentList', () => {
  it('통제 내용을 보여준다', () => {
    render(<AccidentList accidents={[accident()]} onShowOnMap={noop} />)
    expect(screen.getByText('세종대로 사거리 2개 차로 통제')).toBeInTheDocument()
  })

  it('유형과 세부유형을 한 줄로 묶는다', () => {
    render(<AccidentList accidents={[accident()]} onShowOnMap={noop} />)
    expect(screen.getByText('교통사고 · 차대차')).toBeInTheDocument()
  })

  // 유형만 오고 세부유형이 없을 때 구분점이 남으면 「교통사고 ·」가 된다.
  it('세부유형이 없으면 구분점을 남기지 않는다', () => {
    render(<AccidentList accidents={[accident({ detailType: '' })]} onShowOnMap={noop} />)
    expect(screen.getByText('교통사고')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  // 사용자가 실제로 쓰는 값은 「언제 풀리나」다. 발생 시각보다 이쪽이 앞이다.
  it('통제 종료 예정 시각을 보여준다', () => {
    render(<AccidentList accidents={[accident()]} onShowOnMap={noop} />)
    expect(screen.getByText(/10:00까지/)).toBeInTheDocument()
  })

  it('종료 예정이 없으면 그 줄을 만들지 않는다', () => {
    render(<AccidentList accidents={[accident({ expectedClearAt: '' })]} onShowOnMap={noop} />)
    expect(screen.queryByText(/까지/)).not.toBeInTheDocument()
  })

  it('여러 건을 모두 보여준다', () => {
    render(
      <AccidentList
        accidents={[accident(), accident({ info: '남대문로 갓길 통제' })]}
        onShowOnMap={noop}
      />,
    )
    expect(screen.getByText('세종대로 사거리 2개 차로 통제')).toBeInTheDocument()
    expect(screen.getByText('남대문로 갓길 통제')).toBeInTheDocument()
  })

  // **서울이 통제 내용의 영어 원문을 함께 준다**(`ACDNT_ENG_INFO`, 명세에 없는
  // 필드). 이 줄은 자유 문장이라 사전으로 못 옮긴다 — 그동안 영어 화면에서
  // 여기만 한국어로 남아 있었다.
  it('영어 화면에서 서울이 준 영어 원문을 쓴다', () => {
    applyLanguage('en')
    render(
      <AccidentList
        accidents={[
          accident({ infoEn: 'Two lanes closed at Sejong-daero intersection' }),
        ]}
        onShowOnMap={noop}
      />,
    )

    expect(
      screen.getByText('Two lanes closed at Sejong-daero intersection'),
    ).toBeInTheDocument()
    expect(screen.queryByText('세종대로 사거리 2개 차로 통제')).toBeNull()
  })

  // 표본이 두 건뿐이라 「항상 온다」고 단정할 수 없다. 빈 칸을 그리면 통제
  // 내용이 통째로 사라진다.
  it('영어가 안 오면 한국어 원문으로 떨어진다', () => {
    applyLanguage('en')
    render(<AccidentList accidents={[accident()]} onShowOnMap={noop} />)

    expect(screen.getByText('세종대로 사거리 2개 차로 통제')).toBeInTheDocument()
  })

  // 어느 길이 막혔는지는 글로 읽기 어렵다 — 「소공로 서울광장~한국은행앞」은
  // 그 길을 아는 사람만 읽는다.
  it('좌표가 있으면 지도로 보낸다', async () => {
    const onShowOnMap = vi.fn()
    render(
      <AccidentList
        accidents={[accident({ coords: { lat: 37.5715, lng: 126.9769 } })]}
        onShowOnMap={onShowOnMap}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /지도에서 보기/ }))

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '세종대로 사거리 2개 차로 통제',
      coords: { lat: 37.5715, lng: 126.9769 },
    })
  })

  it('좌표가 없으면 지도 버튼을 만들지 않는다', () => {
    render(<AccidentList accidents={[accident()]} onShowOnMap={noop} />)
    expect(screen.queryByRole('button', { name: /지도에서 보기/ })).toBeNull()
  })

  // 지도 버튼의 `aria-label`이 「{시설} 지도에서 보기」다. 한국어 원문을 넘기면
  // 영어 화면의 스크린리더에서만 한국어가 남는다 — 눈으로는 안 보이는 자리다.
  it('영어 화면에서는 지도 버튼 이름도 영어다', () => {
    applyLanguage('en')
    render(
      <AccidentList
        accidents={[
          accident({
            infoEn: 'Two lanes closed',
            coords: { lat: 37.5715, lng: 126.9769 },
          }),
        ]}
        onShowOnMap={noop}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Show Two lanes closed on map' }),
    ).toBeInTheDocument()
  })
})
