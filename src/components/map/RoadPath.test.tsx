import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Coords } from '../../domain/types'
import { RoadPath } from './RoadPath'

// jsdom에는 Google Maps가 없다. 지도 객체와 `Polyline` 생성자를 대신 세운다 —
// **검증 대상은 목이 아니라 `RoadPath`가 무엇을 넘기고 언제 떼어내는가**다.
const useMap = vi.fn()
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => useMap() }))

interface FakeLine {
  readonly options: Record<string, unknown>
  readonly setMap: ReturnType<typeof vi.fn>
}

const lines: FakeLine[] = []
const MAP = { id: 'map' }

const PATH: readonly Coords[] = [
  { lat: 37.5715, lng: 126.9769 },
  { lat: 37.5735, lng: 126.9771 },
]

beforeEach(() => {
  lines.length = 0
  useMap.mockReturnValue(MAP)
  // `google`은 스크립트가 붙은 뒤에만 있는 전역이다. 테스트에서 직접 세운다.
  Object.assign(globalThis, {
    google: {
      maps: {
        Polyline: class {
          setMap = vi.fn()
          constructor(options: Record<string, unknown>) {
            lines.push({ options, setMap: this.setMap })
          }
        },
      },
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'google')
})

describe('RoadPath', () => {
  it('보간점을 그대로 선으로 넘긴다', () => {
    render(<RoadPath path={PATH} />)

    expect(lines).toHaveLength(1)
    expect(lines[0].options.path).toEqual([
      { lat: 37.5715, lng: 126.9769 },
      { lat: 37.5735, lng: 126.9771 },
    ])
    expect(lines[0].options.map).toBe(MAP)
  })

  // 사용자가 직접 누른 결과라 명소 핀에 가리면 안 된다 — `focusedFacility`
  // 마커의 zIndex 10과 같은 이유다.
  it('명소 핀 위에 그린다', () => {
    render(<RoadPath path={PATH} />)

    expect(lines[0].options.zIndex).toBe(10)
  })

  // 선을 누를 일이 없다. 켜 두면 지도 제스처가 선 위에서만 안 먹는다.
  it('선이 제스처를 가로채지 않는다', () => {
    render(<RoadPath path={PATH} />)

    expect(lines[0].options.clickable).toBe(false)
  })

  // **안 떼면 명소를 갈아탈 때마다 선이 하나씩 쌓인다.** 지도 객체는 우리가
  // 만든 것이 아니라 React가 되돌려 주지 않는다.
  it('사라질 때 지도에서 떼어낸다', () => {
    const { unmount } = render(<RoadPath path={PATH} />)
    unmount()

    expect(lines[0].setMap).toHaveBeenCalledWith(null)
  })

  it('선이 바뀌면 앞 선을 떼고 새로 긋는다', () => {
    const { rerender } = render(<RoadPath path={PATH} />)
    rerender(
      <RoadPath
        path={[
          { lat: 37.5, lng: 127 },
          { lat: 37.51, lng: 127.01 },
        ]}
      />,
    )

    expect(lines).toHaveLength(2)
    expect(lines[0].setMap).toHaveBeenCalledWith(null)
  })

  // 점 하나는 선이 아니다. 그리면 지도에 아무것도 안 보인다.
  it('점이 하나뿐이면 아무것도 안 그린다', () => {
    render(<RoadPath path={[{ lat: 37.5715, lng: 126.9769 }]} />)

    expect(lines).toHaveLength(0)
  })

  // 스크립트를 아직 못 받았거나 로드가 실패한 상태다. 그냥 죽으면 화면
  // 전체가 넘어간다 — 지도만 비는 편이 낫다.
  it('지도가 아직 없으면 아무것도 안 그린다', () => {
    useMap.mockReturnValue(null)
    render(<RoadPath path={PATH} />)

    expect(lines).toHaveLength(0)
  })

  // 지도는 왔는데 전역이 없는 상태가 실재한다(로드 실패 경로). 맨몸으로 읽으면
  // ReferenceError가 나서 화면이 통째로 넘어간다.
  it('google 전역이 없어도 죽지 않는다', () => {
    Reflect.deleteProperty(globalThis, 'google')

    expect(() => render(<RoadPath path={PATH} />)).not.toThrow()
    expect(lines).toHaveLength(0)
  })
})
