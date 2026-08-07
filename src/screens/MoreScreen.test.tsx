import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import type { CityInfo } from '../domain/cityInfo'
import { MoreScreen } from './MoreScreen'

vi.mock('../data/queries', () => ({
  useCityInfo: vi.fn(),
}))

vi.mock('../app/locationContext', () => ({
  useLocation: vi.fn(),
}))

const queries = await import('../data/queries')
const locationContext = await import('../app/locationContext')
const useCityInfo = vi.mocked(queries.useCityInfo)
const useLocation = vi.mocked(locationContext.useLocation)

const FULL: CityInfo = {
  areaName: '광화문·덕수궁',
  areaCode: 'POI009',
  weather: {
    temperature: 28.4,
    maxTemperature: 31.5,
    minTemperature: 24.2,
    precipitationMessage: '비 소식은 없어요.',
    pm10: 35,
    pm10Grade: '보통',
    pm25: 18,
    pm25Grade: '보통',
    airGrade: '보통',
    airMessage: '외출 시 특별한 주의가 필요하지 않아요.',
    updatedAt: '2026-08-07 10:00',
  },
  parking: [
    { name: '세종로 공영주차장', capacity: 300, available: 120, liveAvailable: true, paid: true },
    { name: '시청 노외주차장', capacity: 100, available: 0, liveAvailable: true, paid: false },
  ],
  bikes: [{ name: '광화문역 3번출구', bikes: 7, racks: 15 }],
  events: [
    {
      name: '고궁 야간 특별관람',
      period: '2026-08-01~2026-08-31',
      place: '경복궁',
      free: false,
      url: 'https://culture.seoul.go.kr/1',
    },
  ],
  alerts: [],
}

const EMPTY: CityInfo = {
  areaName: '광화문·덕수궁',
  areaCode: 'POI009',
  weather: null,
  parking: [],
  bikes: [],
  events: [],
  alerts: [],
}

function mockQuery(overrides: Partial<UseQueryResult<CityInfo>>): void {
  useCityInfo.mockReturnValue({
    data: FULL,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as UseQueryResult<CityInfo>)
}

beforeEach(() => {
  useLocation.mockReturnValue({ coords: null, status: 'denied', retry: vi.fn() })
  mockQuery({})
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MoreScreen — 명소 선택', () => {
  it('좌표가 없으면 기본 명소를 조회한다', () => {
    render(<MoreScreen />)

    expect(useCityInfo).toHaveBeenCalledWith('광화문·덕수궁')
  })

  it('좌표가 있으면 가장 가까운 명소를 조회한다', () => {
    // 강남역 근처
    useLocation.mockReturnValue({
      coords: { lat: 37.4979, lng: 127.0276 },
      status: 'granted',
      retry: vi.fn(),
    })

    render(<MoreScreen />)

    expect(useCityInfo).toHaveBeenCalledWith('강남역')
  })

  it('명소를 직접 고르면 그 명소를 조회한다', async () => {
    render(<MoreScreen />)

    await userEvent.selectOptions(screen.getByLabelText('명소 선택'), '경복궁')

    expect(useCityInfo).toHaveBeenLastCalledWith('경복궁')
  })

  it('고른 명소는 위치가 뒤늦게 잡혀도 유지된다', async () => {
    // 위치가 늦게 도착한다고 사용자가 고른 명소를 빼앗으면, 스크롤하다 화면이
    // 통째로 바뀐다.
    const { rerender } = render(<MoreScreen />)
    await userEvent.selectOptions(screen.getByLabelText('명소 선택'), '경복궁')

    useLocation.mockReturnValue({
      coords: { lat: 37.4979, lng: 127.0276 },
      status: 'granted',
      retry: vi.fn(),
    })
    rerender(<MoreScreen />)

    expect(useCityInfo).toHaveBeenLastCalledWith('경복궁')
  })
})

describe('MoreScreen — 상태', () => {
  it('불러오는 중에는 스켈레톤을 보여준다', () => {
    mockQuery({ data: undefined, isPending: true })

    render(<MoreScreen />)

    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('실패하면 다시 시도할 수 있다', async () => {
    const refetch = vi.fn()
    mockQuery({ data: undefined, isPending: false, isError: true, refetch })

    render(<MoreScreen />)
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('실패해도 명소 선택은 남는다', () => {
    // 선택을 같이 감추면 다른 명소로 갈아타 볼 수도 없이 막힌다.
    mockQuery({ data: undefined, isPending: false, isError: true })

    render(<MoreScreen />)

    expect(screen.getByLabelText('명소 선택')).toBeInTheDocument()
  })

  it('모든 섹션이 비면 안내 문구 하나만 보여준다', () => {
    mockQuery({ data: EMPTY })

    render(<MoreScreen />)

    expect(screen.getByText(/제공되는 도시 정보가 없어요/)).toBeInTheDocument()
  })
})

describe('MoreScreen — 날씨', () => {
  it('기온과 최고·최저를 보여준다', () => {
    render(<MoreScreen />)

    expect(screen.getByText('28.4°')).toBeInTheDocument()
    expect(screen.getByText(/31.5°/)).toBeInTheDocument()
    expect(screen.getByText(/24.2°/)).toBeInTheDocument()
  })

  it('미세먼지 농도와 등급을 보여준다', () => {
    render(<MoreScreen />)

    expect(screen.getByText(/35/)).toBeInTheDocument()
    expect(screen.getByText('미세먼지')).toBeInTheDocument()
    expect(screen.getByText('초미세먼지')).toBeInTheDocument()
  })

  it('강수 안내를 보여준다', () => {
    render(<MoreScreen />)

    expect(screen.getByText('비 소식은 없어요.')).toBeInTheDocument()
  })
})

describe('MoreScreen — 주차장·따릉이·문화행사', () => {
  it('주차장 여유 면수를 보여준다', () => {
    render(<MoreScreen />)

    expect(screen.getByText('세종로 공영주차장')).toBeInTheDocument()
    expect(screen.getByText(/120/)).toBeInTheDocument()
  })

  it('여유 면수가 0이면 만차로 알려준다', () => {
    render(<MoreScreen />)

    expect(screen.getByText('만차')).toBeInTheDocument()
  })

  it('따릉이 대여 가능 대수를 보여준다', () => {
    render(<MoreScreen />)

    expect(screen.getByText('광화문역 3번출구')).toBeInTheDocument()
  })

  it('문화행사는 링크로 연다', () => {
    render(<MoreScreen />)

    const link = screen.getByRole('link', { name: /고궁 야간 특별관람/ })
    expect(link).toHaveAttribute('href', 'https://culture.seoul.go.kr/1')
    // 미니앱 웹뷰 밖으로 나가는 링크다. opener를 남기지 않는다.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('링크가 없는 행사는 링크로 만들지 않는다', () => {
    mockQuery({ data: { ...FULL, events: [{ ...FULL.events[0], url: '' }] } })

    render(<MoreScreen />)

    expect(screen.queryByRole('link', { name: /고궁 야간 특별관람/ })).not.toBeInTheDocument()
    expect(screen.getByText('고궁 야간 특별관람')).toBeInTheDocument()
  })

  it('섹션이 비면 그 섹션만 빈 안내를 보여준다', () => {
    mockQuery({ data: { ...FULL, bikes: [] } })

    render(<MoreScreen />)

    expect(screen.getByText('주변에 따릉이 대여소가 없어요.')).toBeInTheDocument()
    expect(screen.getByText('세종로 공영주차장')).toBeInTheDocument()
  })
})

describe('MoreScreen — 재난문자', () => {
  it('재난문자가 없으면 배너가 없다', () => {
    render(<MoreScreen />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('재난문자가 있으면 맨 위에 배너로 띄운다', () => {
    mockQuery({
      data: {
        ...FULL,
        alerts: [
          {
            category: '호우',
            step: '주의보',
            message: '하천 산책로 출입을 자제하세요.',
            createdAt: '2026-08-07 09:12',
          },
        ],
      },
    })

    render(<MoreScreen />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('호우')
    expect(alert).toHaveTextContent('하천 산책로 출입을 자제하세요.')
  })
})
