import { useMemo } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { useCctv } from '../../data/queries'
import type { Coords } from '../../domain/types'
import { CctvMarker } from './CctvMarker'

// 고른 명소 주변 CCTV를 지도에 깐다.
//
// **조회를 여기서 한다. `HomeScreen`이 아니다.** 처음에는 화면 꼭대기에서
// `useCctv`를 부르고 마커 배열을 내려보냈는데, 그러면 CCTV 응답이 도착할
// 때마다 **지도·시트·목록이 통째로 다시 그려진다** — 정작 바뀌는 것은 이
// 층뿐인데. 구독을 쓰는 자리까지 내리면 다시 그려지는 것도 이 층뿐이다.
//
// **추가 호출은 0이다.** `CctvSection`이 부르는 것과 queryKey가 같아
// TanStack Query가 한 번만 내보낸다 — 시트와 지도가 같은 캐시 항목을 본다.

interface Props {
  /** 상세가 열린 명소. 목록 화면이면 `undefined`라 조회 자체가 꺼진다. */
  readonly areaName: string | undefined
  readonly openStreamUrl: string | null
  readonly onSelect: (streamUrl: string) => void
}

export function CctvMarkerLayer({ areaName, openStreamUrl, onSelect }: Props) {
  const { data } = useCctv(areaName)

  // 좌표가 있는 것만 지도에 찍을 수 있다. `coords`가 null인 카메라는
  // 목록에는 남지만 지도에서는 찍을 자리가 없다.
  const cameras = useMemo(
    () =>
      (data ?? []).flatMap((camera) =>
        camera.coords === null
          ? []
          : [{ ...camera, coords: camera.coords as Coords }],
      ),
    [data],
  )

  return (
    <>
      {cameras.map((camera) => (
        <AdvancedMarker
          key={camera.streamUrl === '' ? `${camera.name}-${camera.coords.lat}` : camera.streamUrl}
          position={camera.coords}
          // **명소 핀보다 아래다.** 이건 사용자가 부른 것이 아니라 상세를
          // 열면 딸려 오는 층이라 명소 핀을 가리면 안 된다. 방금 짚은
          // 주차장 핀(10)보다도 아래다.
          zIndex={5}
          onClick={() => {
            // 못 트는 카메라는 열 것이 없다.
            if (camera.streamUrl === '') {
              return
            }
            onSelect(camera.streamUrl)
          }}
        >
          <CctvMarker
            name={camera.name}
            active={camera.streamUrl !== '' && camera.streamUrl === openStreamUrl}
            playable={camera.streamUrl !== ''}
          />
        </AdvancedMarker>
      ))}
    </>
  )
}
