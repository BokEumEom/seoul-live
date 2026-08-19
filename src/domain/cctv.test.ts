import { describe, expect, it } from 'vitest'
import { isPlayable, sortCctvByDistance, type CctvCamera } from './cctv'

const ORIGIN = { lat: 37.5, lng: 127 }

function camera(
  name: string,
  streamUrl: string,
  coords: CctvCamera['coords'] = null,
): CctvCamera {
  return { name, coords, streamUrl }
}

describe('isPlayable', () => {
  it('스트림 주소가 있어야 볼 수 있다', () => {
    expect(isPlayable(camera('가', 'https://a/1.m3u8'))).toBe(true)
    expect(isPlayable(camera('나', ''))).toBe(false)
  })
})

describe('sortCctvByDistance', () => {
  it('가까운 순으로 세운다', () => {
    const sorted = sortCctvByDistance(
      [
        camera('먼곳', 'https://a/3.m3u8', { lat: 37.53, lng: 127 }),
        camera('가까운곳', 'https://a/1.m3u8', { lat: 37.501, lng: 127 }),
        camera('중간', 'https://a/2.m3u8', { lat: 37.51, lng: 127 }),
      ],
      ORIGIN,
    )

    expect(sorted.map((c) => c.name)).toEqual(['가까운곳', '중간', '먼곳'])
  })

  // **따릉이와 다르다.** 그쪽은 「빌릴 수 있는 곳이 먼저」로 두 단계인데
  // 여기는 순수 거리순이다 — 샘플(서울 인파레이더)의 목록에서 「영상 없음」인
  // 서울광장 608m가 종로1가 542m와 경복궁역 672m **사이에** 그대로 있다.
  // CCTV는 목록에서 이미 못 튼다는 걸 알 수 있어 헛걸음이 없으니 순서를
  // 흔들 이유가 없다.
  it('영상이 없는 카메라를 뒤로 밀지 않는다', () => {
    const sorted = sortCctvByDistance(
      [
        camera('멀지만 볼 수 있음', 'https://a/1.m3u8', { lat: 37.53, lng: 127 }),
        camera('가깝지만 영상 없음', '', { lat: 37.501, lng: 127 }),
      ],
      ORIGIN,
    )

    expect(sorted[0].name).toBe('가깝지만 영상 없음')
  })

  it('거리를 붙인다', () => {
    const [nearest] = sortCctvByDistance(
      [camera('가', 'https://a/1.m3u8', { lat: 37.501, lng: 127 })],
      ORIGIN,
    )

    expect(nearest.meters).toBeGreaterThan(0)
    expect(nearest.meters).toBeLessThan(200)
  })

  // 0m로 치면 가장 가까운 곳 행세를 한다.
  it('좌표를 모르는 카메라는 맨 뒤다', () => {
    const sorted = sortCctvByDistance(
      [
        camera('모름', 'https://a/2.m3u8'),
        camera('멂', 'https://a/1.m3u8', { lat: 37.6, lng: 127 }),
      ],
      ORIGIN,
    )

    expect(sorted.map((c) => c.name)).toEqual(['멂', '모름'])
    expect(sorted[1].meters).toBeNull()
  })

  // 기준점이 없으면 거리를 못 잰다. 순서를 지어내지 않고 받은 차례를 지킨다.
  it('기준점이 없으면 순서를 흔들지 않는다', () => {
    const cameras = [
      camera('가', 'https://a/1.m3u8', { lat: 37.6, lng: 127 }),
      camera('나', 'https://a/2.m3u8', { lat: 37.5, lng: 127 }),
    ]

    expect(sortCctvByDistance(cameras, null).map((c) => c.name)).toEqual(['가', '나'])
  })

  // 원본을 건드리면 부르는 쪽의 캐시(TanStack Query의 data)가 바뀐다.
  it('원본 배열을 건드리지 않는다', () => {
    const cameras = [
      camera('먼곳', 'https://a/2.m3u8', { lat: 37.6, lng: 127 }),
      camera('가까운곳', 'https://a/1.m3u8', { lat: 37.501, lng: 127 }),
    ]

    sortCctvByDistance(cameras, ORIGIN)

    expect(cameras.map((c) => c.name)).toEqual(['먼곳', '가까운곳'])
  })
})
