import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HourlyForecast } from '../../domain/cityInfo'
import { HourlyWeather } from './HourlyWeather'

function hour(
  time: string,
  temperature: number | null = 31,
  rainChance: number | null = 0,
): HourlyForecast {
  return { time, temperature, rainChance, sky: '맑음', precipitationType: '' }
}

describe('HourlyWeather', () => {
  it('예보 시각을 「14시」로 적는다', () => {
    render(<HourlyWeather hourly={[hour('202608131400')]} />)

    expect(screen.getByText('14시')).toBeInTheDocument()
  })

  it('기온을 소수점 없이 적는다', () => {
    // 타일이 좁다. 카드 상단의 현재 기온과 달리 「31.0°」가 아니라 「31°」다.
    render(<HourlyWeather hourly={[hour('202608131400', 30.6)]} />)

    expect(screen.getByText('31°')).toBeInTheDocument()
    expect(screen.queryByText('31.0°')).not.toBeInTheDocument()
  })

  it('강수확률을 퍼센트로 적는다', () => {
    render(<HourlyWeather hourly={[hour('202608131400', 31, 60)]} />)

    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('강수확률이 0이어도 적는다', () => {
    // falsy 검사로 짜면 「비 올 일 없음」이라는 정보가 화면에서 사라진다.
    render(<HourlyWeather hourly={[hour('202608131400', 31, 0)]} />)

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('강수확률을 모르면 그 줄을 만들지 않는다', () => {
    // 「—%」는 0%로 오독될 수 있다.
    render(<HourlyWeather hourly={[hour('202608131400', 31, null)]} />)

    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('스크린리더가 숫자만 듣지 않도록 강수확률에 이름을 붙인다', () => {
    // 화면에서는 「60%」 두 글자지만 소리로는 무엇의 60%인지 알 수 없다.
    render(<HourlyWeather hourly={[hour('202608131400', 31, 60)]} />)

    expect(screen.getByText('강수확률')).toBeInTheDocument()
  })

  it('받은 칸을 순서대로 모두 그린다', () => {
    const hourly = Array.from({ length: 24 }, (_, index) =>
      hour(`202608${String(13).padStart(2, '0')}${String(index).padStart(2, '0')}00`),
    )

    render(<HourlyWeather hourly={hourly} />)

    // 24시간을 자르지 않는다. 좁은 화면은 가로 스크롤이 받는다 — 잘라내면
    // 「앞으로 몇 시간」을 묻는 사용자가 정작 필요한 시각을 못 본다.
    expect(screen.getAllByRole('listitem')).toHaveLength(24)
  })

  it('예보가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<HourlyWeather hourly={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('시각을 모르는 형식이면 원문을 그대로 보여준다', () => {
    render(<HourlyWeather hourly={[hour('예보 없음')]} />)

    expect(screen.getByText('예보 없음')).toBeInTheDocument()
  })
})
