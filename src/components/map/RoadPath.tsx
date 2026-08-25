import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { Coords } from '../../domain/types'

interface Props {
  readonly path: readonly Coords[]
}

/**
 * 방금 짚은 도로 구간을 지도에 선으로 긋는다. `XYLIST`의 보간점들이다.
 *
 * **다른 「지도에서 보기」와 달리 점이 아니다.** 주차장·따릉이는 자리가 곧
 * 답이지만 도로는 길이가 있는 것이라, 핀만 찍으면 「어디서 어디까지 막히나」가
 * 빠진다. 실호출 구간은 11~653m라 줌 16에서 화면을 가로지르는 길이다.
 *
 * **명령형인 이유.** `@vis.gl/react-google-maps`에는 선을 그리는 컴포넌트가
 * 없다(마커만 있다). 지도 객체를 받아 직접 만들고, 사라질 때 직접 떼어낸다 —
 * 안 떼면 명소를 갈아탈 때마다 선이 하나씩 쌓인다.
 *
 * 색은 마커와 같은 강조색(파랑)이다. 혼잡도 네 색 중 하나를 쓰면 「이 도로가
 * 붐빈다」는 값으로 읽히는데, 이 선은 값이 아니라 **자리**를 가리킨다
 * (`FacilityMarker`와 같은 규칙). 구간의 지표는 목록 줄이 이미 말한다.
 */
export function RoadPath({ path }: Props) {
  const map = useMap()

  useEffect(() => {
    // 지도가 아직 없거나(스크립트 로딩) 선이 될 수 없는 점 수면 아무것도 안 한다.
    if (map === null || path.length < 2) {
      return
    }
    // `google`은 스크립트가 실제로 붙은 뒤에만 있다. 지도는 왔는데 전역이 없는
    // 상태가 실재해서(로드 실패 경로, 그리고 지도를 목업하는 테스트) 한 번 더 본다.
    //
    // **`globalThis.google`이 아니라 `typeof google`이다.** 선언되지 않은
    // 이름은 `globalThis.x`로 읽어도 타입이 없고, 맨몸으로 읽으면 런타임에
    // ReferenceError가 난다 — `typeof`만 둘 다 안전하다.
    if (typeof google === 'undefined') {
      return
    }

    const line = new google.maps.Polyline({
      path: path.map((point) => ({ lat: point.lat, lng: point.lng })),
      map,
      // 명소 핀 위에 온다. 사용자가 직접 누른 결과라 가리면 안 된다
      // (`focusedFacility` 마커의 zIndex 10과 같은 이유).
      zIndex: 10,
      strokeColor: '#1B6EF3',
      strokeOpacity: 0.9,
      strokeWeight: 6,
      // 선을 누를 일이 없다. 켜 두면 지도 제스처가 선 위에서만 안 먹는다.
      clickable: false,
    })

    return () => {
      line.setMap(null)
    }
  }, [map, path])

  return null
}
