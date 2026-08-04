import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SeoulApiError } from '../data/schema'
import { ForecastScreen } from './ForecastScreen'

vi.mock('../platform/links', () => ({
  openExternalUrl: vi.fn(),
  shareMessage: vi.fn(),
}))

// 실제 목업 데이터는 그대로 흘리되, 호출 여부만 감시한다.
vi.mock('../data/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/client')>()
  return { ...actual, fetchAreaSnapshot: vi.fn(actual.fetchAreaSnapshot) }
})

const links = await import('../platform/links')
const client = await import('../data/client')

function renderScreen(areaName: string, onBack = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ForecastScreen areaName={areaName} onBack={onBack} />
    </QueryClientProvider>,
  )
  return onBack
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.clearAllMocks()
})

describe('ForecastScreen', () => {
  it('명소 이름과 혼잡도를 보여준다', async () => {
    renderScreen('성수카페거리')

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '성수카페거리' }),
      ).toBeInTheDocument(),
    )
  })

  it('예측 차트를 그린다', async () => {
    renderScreen('경복궁')

    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: '시간별 혼잡도 예측' }),
      ).toBeInTheDocument(),
    )
  })

  it('길찾기 링크에 명소 이름이 인코딩돼 들어간다', async () => {
    renderScreen('강남역')

    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: '카카오맵 길찾기' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: '카카오맵 길찾기' })).toHaveAttribute(
      'href',
      `https://map.kakao.com/link/search/${encodeURIComponent('강남역')}`,
    )
  })

  it('길찾기를 누르면 기본 이동 대신 네이티브로 연다', async () => {
    renderScreen('강남역')
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: '네이버 길찾기' }),
      ).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('link', { name: '네이버 길찾기' }))

    expect(links.openExternalUrl).toHaveBeenCalledWith(
      `https://map.naver.com/p/search/${encodeURIComponent('강남역')}`,
    )
  })

  it('공유를 누르면 명소 이름이 담긴 메시지를 보낸다', async () => {
    renderScreen('북촌한옥마을')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '친구에게 공유하기' }),
      ).toBeInTheDocument(),
    )

    await userEvent.click(
      screen.getByRole('button', { name: '친구에게 공유하기' }),
    )

    expect(links.shareMessage).toHaveBeenCalledWith(
      '북촌한옥마을 실시간 혼잡도 - 서울 라이브',
    )
  })

  it('카탈로그에 없는 명소는 안내를 보여준다', () => {
    renderScreen('부산역')

    expect(screen.getByText(/명소를 찾을 수 없어요/)).toBeInTheDocument()
  })

  it('카탈로그에 없으면 조회를 시도하지 않는다', async () => {
    // 없는 이름으로 프록시를 때리면 허용 목록에 걸려 400이 오고, 그 실패가
    // 캐시된다. 애초에 보내지 않는다.
    renderScreen('부산역')
    await screen.findByText(/명소를 찾을 수 없어요/)

    expect(client.fetchAreaSnapshot).not.toHaveBeenCalled()
  })

  it('카탈로그에 있으면 그 이름으로 조회한다', async () => {
    renderScreen('경복궁')

    await waitFor(() =>
      expect(client.fetchAreaSnapshot).toHaveBeenCalledWith('경복궁'),
    )
  })

  it('조회에 실패하면 안내와 다시 시도를 보여주고, 누르면 다시 부른다', async () => {
    // 재시도해도 소용없는 에러를 쓴다. 일시적 에러(일반 Error)는 queries.ts의
    // 재시도 정책이 알아서 살려내서 에러 화면 자체가 안 뜬다.
    vi.mocked(client.fetchAreaSnapshot).mockRejectedValueOnce(
      new SeoulApiError('INFO-200', '해당하는 데이터가 없습니다'),
    )
    renderScreen('경복궁')

    await screen.findByText('혼잡도 정보를 가져오지 못했어요.')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() =>
      expect(client.fetchAreaSnapshot).toHaveBeenCalledTimes(2),
    )
    // 두 번째 호출은 목업이 성공하므로 화면이 실제로 복구돼야 한다.
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: '시간별 혼잡도 예측' }),
      ).toBeInTheDocument(),
    )
  })

  it('뒤로 가기를 누르면 콜백이 불린다', async () => {
    const onBack = renderScreen('경복궁')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
