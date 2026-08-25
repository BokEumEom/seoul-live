import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeatherWarning } from '../../domain/cityInfo'
import { WeatherWarningBanner } from './WeatherWarningBanner'

function warning(overrides: Partial<WeatherWarning> = {}): WeatherWarning {
  return {
    kind: '폭염',
    level: '주의보',
    announcedAt: '2026-08-23 11:00',
    command: '발표',
    cancelState: '정상',
    message: '야외활동은 최대한 자제해주세요.',
    ...overrides,
  }
}

describe('WeatherWarningBanner', () => {
  it('종류와 강도를 이어 적고 행동강령을 보여준다', () => {
    render(<WeatherWarningBanner warnings={[warning()]} />)

    expect(screen.getByText('폭염 주의보')).toBeInTheDocument()
    expect(screen.getByText('야외활동은 최대한 자제해주세요.')).toBeInTheDocument()
    expect(screen.getByText('2026-08-23 11:00 발효')).toBeInTheDocument()
  })

  // **재난문자와 같은 급으로 알린다.** 출처는 기상청과 행정안전부로 다르지만
  // 사용자에게는 둘 다 「지금 당장」이라, 한쪽만 조용하면 덜 급한 것으로 읽힌다.
  it('스크린 리더에 경고로 알린다', () => {
    render(<WeatherWarningBanner warnings={[warning()]} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('해제·취소된 특보는 안 그린다', () => {
    render(
      <WeatherWarningBanner
        warnings={[warning({ command: '해제' }), warning({ kind: '호우', cancelState: '취소' })]}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // 도메인의 「모르면 유효한 쪽」이 화면까지 이어지는지 본다. 여기서 걸러
  // 버리면 도메인 단언만으로는 못 잡는다.
  it('처음 보는 상태값은 그대로 띄운다', () => {
    render(<WeatherWarningBanner warnings={[warning({ command: '연장' })]} />)

    expect(screen.getByText('폭염 주의보')).toBeInTheDocument()
  })

  it('유효한 것만 남기고 나머지는 뺀다', () => {
    render(
      <WeatherWarningBanner
        warnings={[warning({ command: '해제' }), warning({ kind: '강풍', level: '경보' })]}
      />,
    )

    expect(screen.getByText('강풍 경보')).toBeInTheDocument()
    expect(screen.queryByText('폭염 주의보')).not.toBeInTheDocument()
  })

  it('특보가 없으면 아무것도 안 그린다', () => {
    const { container } = render(<WeatherWarningBanner warnings={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  // 종류만 오거나 강도만 오는 경우가 있다. 빈 값을 안 걸러내면 「폭염 」처럼
  // 꼬리 공백이 남거나 강도만 덩그러니 뜬다.
  it('한쪽만 와도 구분 공백이 남지 않는다', () => {
    render(<WeatherWarningBanner warnings={[warning({ level: '' })]} />)

    expect(screen.getByText('폭염')).toBeInTheDocument()
  })
})
