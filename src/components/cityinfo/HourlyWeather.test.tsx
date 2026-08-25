import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HourlyForecast } from '../../domain/cityInfo'
import { makeHourlyForecast } from '../../test/cityInfo'
import { HourlyWeather } from './HourlyWeather'

function hour(
  time: string,
  temperature: number | null = 31,
  rainChance: number | null = 0,
): HourlyForecast {
  return makeHourlyForecast({ time, temperature, rainChance, sky: '맑음' })
}

/** 타일 안의 하늘 그림. `sr-only` 낱말과 짝으로만 존재한다. */
function skyGlyphs(container: HTMLElement): readonly Element[] {
  return [...container.querySelectorAll('li svg')]
}

describe('HourlyWeather — 하늘상태', () => {
  // **`SKY_STTS`는 처음부터 파서가 읽고 있었는데 화면에 나온 적이 없었다**
  // (2026-08-25, 시안 `_6`). 스물넉 장을 훑을 때 「몇 시부터 흐린가」에
  // 답하는 것이 이 칸이다.
  it('하늘상태를 그림으로 보여준다', () => {
    const { container } = render(
      <HourlyWeather hourly={[makeHourlyForecast({ time: '202608131400', sky: '흐림' })]} />,
    )

    expect(skyGlyphs(container)).toHaveLength(1)
  })

  // **그림만으로 말하지 않는다.** 색각·저시력·스크린리더 어느 쪽에도 그림은
  // 안 닿는다. 56px 타일에 「구름많음」을 적을 자리가 없어 소리로만 나간다.
  it('하늘상태 낱말을 소리 채널로 함께 내보낸다', () => {
    render(
      <HourlyWeather hourly={[makeHourlyForecast({ time: '202608131400', sky: '구름많음' })]} />,
    )

    expect(screen.getByText('구름많음')).toHaveClass('sr-only')
  })

  // 세 값이 서로 다른 그림이어야 한다. 표를 한 칸만 잘못 옮기면 「맑음」과
  // 「흐림」이 같은 그림이 되는데, 하나만 보는 테스트로는 안 잡힌다.
  it('맑음·구름많음·흐림이 서로 다른 그림이다', () => {
    const { container } = render(
      <HourlyWeather
        hourly={[
          makeHourlyForecast({ time: '202608131400', sky: '맑음' }),
          makeHourlyForecast({ time: '202608131500', sky: '구름많음' }),
          makeHourlyForecast({ time: '202608131600', sky: '흐림' }),
        ]}
      />,
    )
    const shapes = skyGlyphs(container).map(
      (svg) => svg.querySelector('path')?.getAttribute('d') ?? '',
    )

    expect(new Set(shapes).size).toBe(3)
  })

  // **모르는 값에 그림을 지어내지 않는다.** 명세에 값 목록이 없어 처음 보는
  // 하늘상태가 올 수 있다 — 그때 아무 구름이나 그리면 앱이 하지 않은 판단을
  // 한 것이 된다(`?? null` 규칙).
  it('모르는 하늘상태는 칸을 비운다', () => {
    const { container } = render(
      <HourlyWeather hourly={[makeHourlyForecast({ time: '202608131400', sky: '천둥번개' })]} />,
    )

    expect(skyGlyphs(container)).toHaveLength(0)
    expect(screen.queryByText('천둥번개')).toBeNull()
  })
})

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

  // **확률과 다른 값이다** — 「70%」는 올지 말지이고 이건 오면 얼마나 오는지다.
  // 우산이냐 우비냐가 여기서 갈린다.
  it('강수량이 있으면 확률과 함께 적는다', () => {
    render(
      <HourlyWeather
        hourly={[makeHourlyForecast({ time: '202608131400', rainChance: 70, precipitation: 2 })]}
      />,
    )

    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('2mm')).toBeInTheDocument()
  })

  // 실호출 840칸 중 값이 있던 것은 75칸뿐이다(나머지는 `-`). 항상 그리면
  // 56px 타일 스물넉 장이 「0mm」로 채워진다.
  it('안 오는 시각에는 그 줄을 만들지 않는다', () => {
    render(
      <HourlyWeather hourly={[makeHourlyForecast({ time: '202608131400', rainChance: 0 })]} />,
    )

    expect(screen.queryByText(/mm/)).toBeNull()
  })

  // `-`가 null이 되는 것이 파서의 일이고, 0으로 오는 경우까지 여기서 접는다 —
  // 「0mm」는 바로 옆 「0%」가 이미 하는 말이다.
  it('0mm도 적지 않는다', () => {
    render(
      <HourlyWeather
        hourly={[makeHourlyForecast({ time: '202608131400', precipitation: 0 })]}
      />,
    )

    expect(screen.queryByText(/mm/)).toBeNull()
  })
})
