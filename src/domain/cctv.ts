import type { Coords } from './types'

/**
 * 지금 볼 수 있는 교통 CCTV 한 대.
 *
 * **`streamUrl`은 언제나 비어 있지 않다.** 스트림이 없는 카메라는 파서가
 * 버린다(`cctvSchema.ts`) — 실응답에 위치만 있고 영상이 없는 행이 섞여 오는데,
 * 「실시간 영상」이라 적어 놓고 못 트는 줄을 세우면 약속을 어기는 것이다.
 * 화면이 「틀 수 있나」를 매번 되묻지 않게 경계를 여기서 긋는다
 * (`FacilityLocation`이 좌표에 대해 하는 것과 같은 판단).
 *
 * 반대로 `coords`는 없을 수 있다. **영상이 본체이고 지도는 덤이라서** 좌표가
 * 없다고 버리면 볼 수 있는 카메라가 사라진다.
 */
export interface CctvCamera {
  readonly name: string
  readonly coords: Coords | null
  /** 재생 가능한 HTTPS HLS 주소(m3u8). 근거는 `api/_lib/seoulRtd.ts`. */
  readonly streamUrl: string
}
