import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TONE_TEXT_CLASS } from '../common/toneClass'
import { makeWeather } from '../../test/cityInfo'
import { WeatherStats } from './WeatherStats'

describe('WeatherStats', () => {
  it('습도·바람·자외선·일출일몰을 네 칸으로 그린다', () => {
    render(
      <WeatherStats
        weather={makeWeather({
          humidity: 70,
          windDirection: 'SSE',
          windSpeed: 2.8,
          uvIndex: 7,
          uvGrade: '높음',
          sunrise: '05:43',
          sunset: '19:31',
        })}
      />,
    )

    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('2.8m/s')).toBeInTheDocument()
    expect(screen.getByText('남남동')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('높음')).toBeInTheDocument()
    expect(screen.getByText('05:43 · 19:31')).toBeInTheDocument()
  })

  // **칸마다 따로 빠진다.** 서울 API는 필드 단위로 비워 보내므로 넷을 한 덩어리로
  // 묶으면 습도 하나 때문에 바람까지 사라진다.
  it('없는 칸만 빠지고 나머지는 남는다', () => {
    render(<WeatherStats weather={makeWeather({ humidity: 55 })} />)

    expect(screen.getByText('55%')).toBeInTheDocument()
    expect(screen.queryByText('바람')).not.toBeInTheDocument()
    expect(screen.queryByText('자외선지수')).not.toBeInTheDocument()
    expect(screen.queryByText('일출 · 일몰')).not.toBeInTheDocument()
  })

  it('넷 다 없으면 절 자체가 안 그려진다', () => {
    const { container } = render(<WeatherStats weather={makeWeather()} />)

    expect(container).toBeEmptyDOMElement()
  })

  // 「지어내지 않는다」가 화면까지 이어지는지 본다. 도메인이 null을 줘도
  // 화면이 빈칸을 그리면 방위가 통째로 사라진다.
  it('모르는 풍향은 원문을 그대로 적는다', () => {
    render(<WeatherStats weather={makeWeather({ windDirection: 'SSSE', windSpeed: 1.2 })} />)

    expect(screen.getByText('SSSE')).toBeInTheDocument()
  })

  it('풍속만 없으면 대시를 쓰고 방향은 남긴다', () => {
    render(<WeatherStats weather={makeWeather({ windDirection: 'N' })} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('북')).toBeInTheDocument()
  })

  // **자외선에만 색이 붙는다.** 습도·풍속은 좋고 나쁨의 눈금이 아니다 —
  // 톤을 붙이면 「습도 80%가 나쁜 것」이라고 앱이 단정하게 된다.
  it('자외선 단계에 톤이 붙는다', () => {
    render(<WeatherStats weather={makeWeather({ uvIndex: 9, uvGrade: '매우높음' })} />)

    expect(screen.getByText('9')).toHaveClass(TONE_TEXT_CLASS.crowded)
  })

  it('모르는 자외선 단계에는 색을 안 붙인다', () => {
    render(<WeatherStats weather={makeWeather({ uvIndex: 9, uvGrade: '아주높음' })} />)

    expect(screen.getByText('9')).not.toHaveClass(TONE_TEXT_CLASS.crowded)
  })

  it('습도에는 톤을 붙이지 않는다', () => {
    render(<WeatherStats weather={makeWeather({ humidity: 95 })} />)

    const value = screen.getByText('95%')
    for (const className of Object.values(TONE_TEXT_CLASS)) {
      expect(value).not.toHaveClass(className)
    }
  })
})
