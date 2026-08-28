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

const ORIGIN = { lat: 37.5, lng: 127 }

function camera(
  name: string,
  streamUrl: string,
  coords: CctvCamera['coords'] = null,
): CctvCamera {
  return { name, coords, streamUrl }
}

function ok(cameras: readonly CctvCamera[]): UseQueryResult<readonly CctvCamera[]> {
  return { data: cameras, isPending: false, isError: false } as UseQueryResult<
    readonly CctvCamera[]
  >
}

function renderSection(
  cameras: readonly CctvCamera[],
  openStreamUrl: string | null = null,
  onToggle = vi.fn(),
) {
  useCctv.mockReturnValue(ok(cameras))
  const result = render(
    <CctvSection
      areaName="광화문·덕수궁"
      origin={ORIGIN}
      openStreamUrl={openStreamUrl}
      onToggle={onToggle}
    />,
  )
  return { ...result, onToggle }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CctvSection', () => {
  // **이 파일에서 가장 중요한 단언이다.** 자동 재생이 느렸던 원인이 바로
  // 이것이었다 — 절이 뜨자마자 hls.js 500KB + 2.5MB 세그먼트를 받았다.
  // 샘플(서울 인파레이더)이 빠른 이유는 기술이 아니라 아무것도 안 틀기
  // 때문이고, 그걸 여기서 잠근다.
  it('펼치기 전에는 영상을 하나도 틀지 않는다', () => {
    renderSection([
      camera('광화문', 'https://a/1.m3u8'),
      camera('청계광장', 'https://a/2.m3u8'),
    ])

    expect(screen.queryByTestId('player')).not.toBeInTheDocument()
  })

  it('카메라 이름을 거리와 함께 줄로 세운다', () => {
    renderSection([camera('광화문', 'https://a/1.m3u8', { lat: 37.505, lng: 127 })])

    expect(screen.getByRole('button', { name: /광화문/ })).toBeInTheDocument()
    // 555m 남짓. 단위까지 확인해 거리 자체가 붙었음을 잠근다.
    expect(screen.getByText(/m$|km$/)).toBeInTheDocument()
  })

  it('줄을 누르면 그 카메라를 열어 달라고 알린다', async () => {
    const { onToggle } = renderSection([camera('광화문', 'https://a/1.m3u8')])

    await userEvent.click(screen.getByRole('button', { name: /광화문/ }))

    expect(onToggle).toHaveBeenCalledWith('https://a/1.m3u8')
  })

  it('열어 둔 줄에만 플레이어가 붙는다', () => {
    renderSection(
      [camera('광화문', 'https://a/1.m3u8'), camera('청계광장', 'https://a/2.m3u8')],
      'https://a/2.m3u8',
    )

    const players = screen.getAllByTestId('player')
    expect(players).toHaveLength(1)
    expect(players[0]).toHaveAttribute('data-stream', 'https://a/2.m3u8')
  })

  // 색으로만 「열려 있다」를 말하면 스크린리더에 안 전해진다.
  it('열림 여부를 aria-expanded로 알린다', () => {
    renderSection(
      [camera('광화문', 'https://a/1.m3u8'), camera('청계광장', 'https://a/2.m3u8')],
      'https://a/1.m3u8',
    )

    expect(screen.getByRole('button', { name: /광화문/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: /청계광장/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  // **샘플이 그렇게 한다.** 「서울광장 608m 영상 없음」처럼 목록에 남기고
  // 못 튼다고 적는다 — 조용히 빼면 「왜 이 자리 CCTV는 안 보이지」에 화면이
  // 답하지 못한다. 실응답에도 그런 행이 실제로 온다.
  it('영상이 없는 카메라도 목록에 남기고 없다고 적는다', () => {
    renderSection([camera('서울광장', '')])

    expect(screen.getByText('서울광장')).toBeInTheDocument()
    expect(screen.getByText('영상 없음')).toBeInTheDocument()
  })

  // 눌러도 아무 일이 없는 버튼은 고장으로 보인다.
  it('영상이 없는 줄은 누를 수 없다', async () => {
    const { onToggle } = renderSection([camera('서울광장', '')])

    const row = screen.getByRole('button', { name: /서울광장/ })
    expect(row).toBeDisabled()

    await userEvent.click(row)
    expect(onToggle).not.toHaveBeenCalled()
  })

  // 순수 거리순이다 — 볼 수 있는 것을 앞으로 당기지 않는다(샘플이 그렇다).
  it('거리순으로 세우고 영상 없는 것도 제자리에 둔다', () => {
    renderSection([
      camera('먼곳', 'https://a/3.m3u8', { lat: 37.53, lng: 127 }),
      camera('중간(영상없음)', '', { lat: 37.51, lng: 127 }),
      camera('가까운곳', 'https://a/1.m3u8', { lat: 37.501, lng: 127 }),
    ])

    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(names[0]).toContain('가까운곳')
    expect(names[1]).toContain('중간(영상없음)')
    expect(names[2]).toContain('먼곳')
  })

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
      <CctvSection
        areaName="광화문·덕수궁"
        origin={ORIGIN}
        openStreamUrl={null}
        onToggle={() => undefined}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // 다른 절은 최대 1시간 묵은 값이라 기준 시각을 적지만, 여기서 같은 문구를
  // 쓰면 영상이 묵은 것처럼 읽힌다.
  it('묵은 값이라고 적지 않는다', () => {
    renderSection([camera('광화문', 'https://a/1.m3u8')])

    expect(screen.queryByText(/최대 1시간/)).not.toBeInTheDocument()
  })
})
