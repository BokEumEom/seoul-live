import { withDistanceFrom, type WithDistance } from './facilityDistance'
import type { Coords } from './types'

/**
 * 명소 주변 교통 CCTV 한 대.
 *
 * **`streamUrl`이 빈 문자열일 수 있다.** 처음에는 못 트는 카메라를 파서가
 * 버렸는데, 샘플(서울 인파레이더)을 보고 되돌렸다 — 그쪽은 「서울광장
 * 608m **영상 없음**」처럼 **목록에 남기고 못 튼다고 적는다.** 그게 맞다:
 * 카메라가 거기 있다는 것 자체가 정보이고, 조용히 빼면 「왜 이 자리 CCTV는
 * 안 보이지」라는 질문에 화면이 답하지 못한다.
 *
 * 화면은 `streamUrl === ''`를 「펼칠 수 없는 줄」로 그린다.
 */
export interface CctvCamera {
  readonly name: string
  readonly coords: Coords | null
  /** 재생 가능한 HTTPS HLS 주소(m3u8). **없으면 빈 문자열이다.** */
  readonly streamUrl: string
}

/** 이 카메라를 지금 볼 수 있나. */
export function isPlayable(camera: CctvCamera): boolean {
  return camera.streamUrl !== ''
}

/**
 * 명소에서 가까운 순으로 세운다.
 *
 * **볼 수 있는 것을 앞으로 당기지 않는다.** 따릉이(`sortBikesForWalking`)는
 * 「빌릴 수 있는 곳이 먼저」로 두 단계인데 여기는 순수 거리순이다 — 샘플이
 * 그렇게 한다(「영상 없음」인 서울광장 608m가 종로1가 542m와 경복궁역 672m
 * **사이에** 그대로 있다). 따릉이는 없는 곳에 가면 헛걸음이지만 CCTV는
 * 목록에서 이미 못 튼다는 걸 알 수 있어 헛걸음이 없다. 그러니 순서를
 * 흔들 이유가 없고, **거리 하나로만 세워야 「이 근처 어디에 있나」가 읽힌다.**
 *
 * 거리를 모르는 카메라는 맨 뒤다. 0m로 치면 가장 가까운 곳 행세를 한다.
 */
export function sortCctvByDistance(
  cameras: readonly CctvCamera[],
  origin: Coords | null,
): readonly WithDistance<CctvCamera>[] {
  return withDistanceFrom(cameras, origin).toSorted((a, b) => {
    if ((a.meters === null) !== (b.meters === null)) {
      return a.meters === null ? 1 : -1
    }
    return (a.meters ?? 0) - (b.meters ?? 0)
  })
}
