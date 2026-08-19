import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CctvCamera } from '../../domain/cctv'
import { CctvSection } from './CctvSection'

vi.mock('../../data/queries', () => ({ useCctv: vi.fn() }))
// 플레이어는 hls.js를 동적으로 부르고 jsdom에는 미디어 스택이 없다. 이 파일이
// 검증하는 것은 「무엇을 언제 보여주는가」이지 재생 자체가 아니다 — 재생 쪽
// 판단은 CctvPlayer.test.tsx가 따로 본다.
vi.mock('./CctvPlayer', () => ({
  CctvPlayer: ({ name, streamUrl }: { name: string; streamUrl: string }) => (
    <div data-testid="player" data-stream={streamUrl}>
      {name}
    </div>
  ),
}))

const queries = await import('../../data/queries')
const useCctv = vi.mocked(queries.useCctv)

function camera(name: string, streamUrl: string, coords: CctvCamera['coords'] = null): CctvCamera {
  return { name, coords, streamUrl }
}

function ok(cameras: readonly CctvCamera[]): UseQueryResult<readonly CctvCamera[]> {
  return { data: cameras, isPending: false, isError: false } as UseQueryResult<
    readonly CctvCamera[]
  >
}

function renderSection(cameras: readonly CctvCamera[]) {
  useCctv.mockReturnValue(ok(cameras))
  return render(<CctvSection areaName="광화문·덕수궁" onShowOnMap={() => undefined} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CctvSection', () => {
  it('첫 카메라를 자동으로 튼다', () => {
    renderSection([camera('광화문', 'https://a/1.m3u8'), camera('세종대로', 'https://a/2.m3u8')])

    expect(screen.getByTestId('player')).toHaveAttribute('data-stream', 'https://a/1.m3u8')
  })

  // **한 번에 한 대만 튼다.** 명동은 카메라가 7대인데 전부 동시에 흐르면
  // 모바일 데이터·배터리를 일곱 배로 먹고 서울시 프록시에도 일곱 배로 매달린다.
  it('카메라가 여럿이어도 플레이어는 하나뿐이다', () => {
    renderSection([
      camera('광화문', 'https://a/1.m3u8'),
      camera('세종대로', 'https://a/2.m3u8'),
      camera('시청', 'https://a/3.m3u8'),
    ])

    expect(screen.getAllByTestId('player')).toHaveLength(1)
  })

  it('다른 카메라를 누르면 그 영상으로 갈아탄다', async () => {
    renderSection([camera('광화문', 'https://a/1.m3u8'), camera('세종대로', 'https://a/2.m3u8')])

    await userEvent.click(screen.getByRole('button', { name: '세종대로' }))

    expect(screen.getByTestId('player')).toHaveAttribute('data-stream', 'https://a/2.m3u8')
  })

  // 색으로만 「지금 이걸 보고 있다」를 말하면 스크린리더에 안 전해진다.
  it('고른 카메라를 aria-pressed로 알린다', async () => {
    renderSection([camera('광화문', 'https://a/1.m3u8'), camera('세종대로', 'https://a/2.m3u8')])

    expect(screen.getByRole('button', { name: '광화문' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(screen.getByRole('button', { name: '세종대로' }))

    expect(screen.getByRole('button', { name: '세종대로' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '광화문' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  // 버튼 하나짜리 목록은 무엇을 하라는 것인지 알려주지 못한다.
  it('카메라가 하나면 고르는 줄을 만들지 않는다', () => {
    renderSection([camera('광화문', 'https://a/1.m3u8')])

    expect(screen.queryByRole('button', { name: '광화문' })).not.toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  // 30곳 중 10곳이 이 상태다(2026-08-19 실측). 정상 상태이므로 오류처럼
  // 보이면 안 된다.
  it('카메라가 없으면 없다고 적는다', () => {
    renderSection([])

    expect(screen.getByText('이 명소 주변에는 공개된 CCTV가 없어요.')).toBeInTheDocument()
    expect(screen.queryByTestId('player')).not.toBeInTheDocument()
  })

  // **조회 중에는 절 자체를 그리지 않는다.** 스켈레톤을 띄우면 CCTV가 없는
  // 10곳에서 없는 절이 잠깐 나타났다 사라져 화면이 덜컹인다.
  it('조회 중에는 아무것도 그리지 않는다', () => {
    useCctv.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as UseQueryResult<readonly CctvCamera[]>)

    const { container } = render(
      <CctvSection areaName="광화문·덕수궁" onShowOnMap={() => undefined} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // 좌표가 있는 카메라만 지도로 보낼 수 있다 — 눌러도 아무 일이 없는 버튼은
  // 고장으로 보인다(`ShowOnMapButton`과 같은 규칙).
  it('좌표가 있으면 지도 버튼을 주고 누르면 그 자리를 넘긴다', async () => {
    const onShowOnMap = vi.fn()
    useCctv.mockReturnValue(ok([camera('광화문', 'https://a/1.m3u8', { lat: 37.5, lng: 127 })]))
    render(<CctvSection areaName="광화문·덕수궁" onShowOnMap={onShowOnMap} />)

    await userEvent.click(screen.getByRole('button', { name: '광화문 지도에서 보기' }))

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '광화문',
      coords: { lat: 37.5, lng: 127 },
    })
  })

  it('좌표가 없으면 지도 버튼을 만들지 않는다', () => {
    renderSection([camera('광화문', 'https://a/1.m3u8')])

    expect(screen.queryByRole('button', { name: /지도에서 보기/ })).not.toBeInTheDocument()
  })

  // **이 절만 진짜 실시간이다.** 다른 절은 최대 3시간 묵은 값을 보여주므로
  // 기준 시각을 적지만, 여기서 같은 문구를 쓰면 영상이 묵은 것처럼 읽힌다.
  it('영상이 있으면 지금 화면이라고 적는다', () => {
    renderSection([camera('광화문', 'https://a/1.m3u8')])

    expect(screen.getByText('영상은 지금 화면이에요')).toBeInTheDocument()
    expect(screen.queryByText(/최대 3시간/)).not.toBeInTheDocument()
  })
})
